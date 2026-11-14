import { type EstadoItem, TRANSICOES_ITEM, transicionar } from "./contratos.ts";
import { type DiaSessao, type Estacao, elegiveis, ficarElegivel, type ItemFila } from "./fila.ts";
import { type CodigoErro, type Evento, falha, ok, type Resultado } from "./resultado.ts";
import type { NivelRisco } from "./tipos.ts";

type Cmd = { estacaoId: string };

/**
 * Fechar o chamado da estação (Finalizar ou chamar o próximo). Na triagem, o profissional pode
 * confirmar ou reclassificar o risco de quem sai dela (RN-TRI-03, RN-RISCO-01).
 */
type CmdFechar = Cmd & { riscoConfirmado?: NivelRisco };

const MIN = 60_000;
const EVENTO_CHAMAR = "Estação chama o próximo";
const EVENTO_ENCERRAR = "Estação chama o próximo ou toca Finalizar";
const EVENTO_NAO_COMPARECEU = '"Não compareceu"';

const comEstacao = (dia: DiaSessao, estacaoId: string, parcial: Partial<Estacao>): DiaSessao => ({
  ...dia,
  estacoes: dia.estacoes.map((e) => (e.id === estacaoId ? { ...e, ...parcial } : e)),
});

const comItem = (dia: DiaSessao, novo: ItemFila): DiaSessao => ({
  ...dia,
  itens: dia.itens.map((i) => (i.id === novo.id ? novo : i)),
});

/** Ninguém fica travado atrás de quem deixou a sala (chamado, foi para casa, saiu da fila). */
const soltarTravas = (dia: DiaSessao, itemId: string): DiaSessao => ({
  ...dia,
  itens: dia.itens.map((i) =>
    i.travadoAtras.includes(itemId) ? { ...i, travadoAtras: i.travadoAtras.filter((t) => t !== itemId) } : i,
  ),
});

const base = (dia: DiaSessao, i: ItemFila, estacaoId: string) => ({
  itemId: i.id,
  entradaId: i.entradaId,
  estacaoId,
  sessaoId: dia.sessaoId,
});

type ChamadoNaEstacao =
  | { ok: true; estacao: Estacao; item: ItemFila }
  | { ok: false; erro: "sessao_fechada" | "transicao_proibida" };

/**
 * O paciente chamado nesta estação, nesta sessão. Um chamado de outra sessão (item que não está
 * aqui) não é deste dia: as ações sobre ele recusam em vez de derrubá-lo.
 */
function chamadoNaEstacao(dia: DiaSessao, estacaoId: string): ChamadoNaEstacao {
  if (dia.estado !== "aberta") return { ok: false, erro: "sessao_fechada" };
  const estacao = dia.estacoes.find((e) => e.id === estacaoId);
  const item = estacao?.chamadoItemId ? dia.itens.find((i) => i.id === estacao.chamadoItemId) : undefined;
  if (!estacao || item?.estado !== "chamado") return { ok: false, erro: "transicao_proibida" };
  return { ok: true, estacao, item };
}

/**
 * Risco confirmado na saída da triagem (RN-TRI-03): só na etapa de triagem; emergência não fica
 * na fila (vai à emergência, como no questionário e na regulação, RN-LE-01).
 */
function riscoInvalido(item: ItemFila | undefined, risco: NivelRisco | undefined): CodigoErro | null {
  if (risco === undefined) return null;
  if (item?.estado !== "chamado" || item.etapa !== "triagem") return "transicao_proibida";
  return risco === "emergencia" ? "emergencia" : null;
}

/**
 * Encerra o chamado como atendido na etapa (RN-CHAM-02). Da triagem, entra presente no atendimento
 * com a mesma senha e o mesmo número, sem regra de atraso (RN-TRI-04), já com o risco confirmado
 * pela triagem, se houver (RN-TRI-03/04: a ordem do atendimento usa a classificação confirmada).
 */
function encerrarChamado(
  dia: DiaSessao,
  estacao: Estacao,
  item: ItemFila,
  agora: number,
  riscoConfirmado?: NivelRisco,
): { dia: DiaSessao; eventos: Evento[] } {
  if (transicionar(TRANSICOES_ITEM, item.estado, EVENTO_ENCERRAR) !== "atendido_na_etapa") {
    throw new Error(`contrato: ${item.estado} não encerra`);
  }
  const atendidoEmEtapas = [...item.atendidoEmEtapas, item.etapa];
  const proximaEtapa = item.etapa === "triagem" ? ("atendimento" as const) : null;
  const eventos: Evento[] = [
    { tipo: "atendido", ...base(dia, item, estacao.id), dados: { etapa: item.etapa, proximaEtapa, em: agora } },
  ];
  const livre = comEstacao(dia, estacao.id, { chamadoItemId: null });
  if (proximaEtapa === null) {
    return { dia: comItem(livre, { ...item, estado: "atendido_na_etapa", atendidoEmEtapas }), eventos };
  }
  let triado: ItemFila = { ...item, etapa: proximaEtapa, atendidoEmEtapas, saiuEm: null };
  if (riscoConfirmado !== undefined && riscoConfirmado !== "emergencia") {
    triado = { ...triado, risco: riscoConfirmado, urgenciaConfirmada: riscoConfirmado === "urgente" };
    // A API grava entrada.riscoConfirmado (INV-07: só agendador ou triagem).
    eventos.push({
      tipo: "risco_confirmado",
      ...base(dia, item, estacao.id),
      dados: { nivel: riscoConfirmado, etapa: item.etapa },
    });
  }
  const naProxima = comItem(livre, triado);
  return { dia: ficarElegivel(naProxima, item.id, agora, { aplicarAtraso: false }).estado, eventos };
}

/**
 * RN-CHAM-01/02: encerra o chamado anterior desta estação e chama o 1º elegível dela. Na triagem,
 * `riscoConfirmado` confirma ou reclassifica o risco de quem sai (RN-TRI-03).
 * Sem elegível, o chamado anterior é finalizado e a estação fica livre (ok, sem evento "chamado");
 * sem chamado anterior (ou estação fechada), `nenhum_elegivel` sem mudar nada. A seleção usa o estado recebido: uma 2ª estação chamando
 * sobre o estado devolvido pela 1ª não pega o mesmo paciente (INV-04).
 */
export function chamarProximo(dia: DiaSessao, cmd: CmdFechar, agora: number): Resultado<DiaSessao> {
  if (dia.estado !== "aberta") return falha("sessao_fechada");
  const estacao = dia.estacoes.find((e) => e.id === cmd.estacaoId);
  if (!estacao?.aberta) return falha("nenhum_elegivel");
  const anterior = estacao.chamadoItemId ? dia.itens.find((i) => i.id === estacao.chamadoItemId) : undefined;
  // Chamado de outra sessão em aberto nesta estação: não é derrubado.
  if (estacao.chamadoItemId !== null && anterior === undefined) return falha("estacao_ocupada");
  const invalido = riscoInvalido(anterior, cmd.riscoConfirmado);
  if (invalido) return falha(invalido);

  let atual = dia;
  const eventos: Evento[] = [];
  if (anterior?.estado === "chamado") {
    const fechado = encerrarChamado(atual, estacao, anterior, agora, cmd.riscoConfirmado);
    atual = fechado.dia;
    eventos.push(...fechado.eventos);
  }
  const proximo = elegiveis(atual, estacao.id)[0];
  // RN-CHAM-01: sem elegível, o chamado anterior fica encerrado e a estação livre ("ninguém aguardando").
  if (!proximo) return eventos.length > 0 ? ok(atual, eventos) : falha("nenhum_elegivel");
  if (transicionar(TRANSICOES_ITEM, proximo.estado, EVENTO_CHAMAR) !== "chamado") {
    throw new Error(`contrato: ${proximo.estado} não é chamado`);
  }
  atual = soltarTravas(atual, proximo.id);
  atual = comItem(atual, { ...proximo, estado: "chamado", travadoAtras: [] });
  atual = comEstacao(atual, estacao.id, { chamadoItemId: proximo.id });
  atual = {
    ...atual,
    chamadas: [...atual.chamadas, { itemId: proximo.id, etapa: proximo.etapa, estacaoId: estacao.id, em: agora }],
  };
  eventos.push({
    tipo: "chamado",
    ...base(dia, proximo, estacao.id),
    dados: { senha: proximo.senha, etapa: proximo.etapa, em: agora },
  });
  return ok(atual, eventos);
}

/** RN-CHAM-02: repete o anúncio; a tolerância conta da chamada, então não reinicia. */
export function rechamar(dia: DiaSessao, cmd: Cmd, agora: number): Resultado<DiaSessao> {
  const achado = chamadoNaEstacao(dia, cmd.estacaoId);
  if (!achado.ok) return falha(achado.erro);
  if (transicionar(TRANSICOES_ITEM, achado.item.estado, "Rechamar") !== "(mesmo)") return falha("transicao_proibida");
  const ultima = dia.chamadas.findLastIndex((c) => c.itemId === achado.item.id);
  const chamadas = dia.chamadas.map((c, i) =>
    i === ultima ? { ...c, rechamadas: [...(c.rechamadas ?? []), agora] } : c,
  );
  return ok({ ...dia, chamadas }, [
    { tipo: "rechamado", ...base(dia, achado.item, cmd.estacaoId), dados: { senha: achado.item.senha, em: agora } },
  ]);
}

/** RN-CHAM-02: encerra o atendimento atual sem chamar outro; na triagem, com o risco confirmado (RN-TRI-03). */
export function finalizar(dia: DiaSessao, cmd: CmdFechar, agora: number): Resultado<DiaSessao> {
  const achado = chamadoNaEstacao(dia, cmd.estacaoId);
  if (!achado.ok) return falha(achado.erro);
  const invalido = riscoInvalido(achado.item, cmd.riscoConfirmado);
  if (invalido) return falha(invalido);
  const fechado = encerrarChamado(dia, achado.estacao, achado.item, agora, cmd.riscoConfirmado);
  return ok(fechado.dia, fechado.eventos);
}

/** Linha do contrato escolhida pelos pulos no dia (a transição depende da condição). */
function destinoDoPulo(pulos: number): EstadoItem {
  const condicao = `Pulos no dia = ${Math.min(pulos, 2)}`;
  const linha = TRANSICOES_ITEM.find(
    (t) => t.de === "chamado" && t.evento === EVENTO_NAO_COMPARECEU && t.condicao === condicao,
  );
  if (!linha || linha.para === "(mesmo)" || linha.para === "(não cria)") {
    throw new Error(`contrato: sem linha para ${condicao}`);
  }
  return linha.para;
}

/**
 * RN-CHAM-03: os pulos somam as etapas. 1º: presente atrás dos próximos K, sem atraso;
 * 2º: remoto, e ao voltar só contam as chamadas feitas depois daqui (`saiuEm`);
 * 3º: sai da fila com falta "não compareceu à chamada" (RN-FALTA-02); a entrada vai a "Encerrada sem
 * atendimento" com `desfechoDaEntrada` (ou no encerramento).
 */
export function naoCompareceu(dia: DiaSessao, cmd: Cmd, agora: number): Resultado<DiaSessao> {
  const achado = chamadoNaEstacao(dia, cmd.estacaoId);
  if (!achado.ok) return falha(achado.erro);
  const { item } = achado;
  const para = destinoDoPulo(item.pulos);
  const pulos = item.pulos + 1;
  const livre = comEstacao(dia, cmd.estacaoId, { chamadoItemId: null });
  const ids = base(dia, item, cmd.estacaoId);
  const pulado: Evento = { tipo: "pulado", ...ids, dados: { pulos, para, em: agora } };
  const ultimaChamada = dia.chamadas.findLastIndex((c) => c.itemId === item.id);
  const marcarPulo = (d: DiaSessao): DiaSessao => ({
    ...d,
    chamadas: d.chamadas.map((c, i) => (i === ultimaChamada ? { ...c, naoCompareceu: true } : c)),
  });

  if (para === "presente") {
    const eleg = ficarElegivel(comItem(livre, { ...item, pulos }), item.id, agora, { aplicarAtraso: false });
    return ok(marcarPulo(eleg.estado), [pulado]);
  }
  const fora: ItemFila = {
    ...item,
    estado: para,
    pulos,
    travadoAtras: [],
    saiuEm: para === "remoto" ? agora : item.saiuEm,
    motivoSaida: para === "saiu_da_fila" ? "pulos" : null,
  };
  const atual = soltarTravas(comItem(livre, fora), item.id);
  if (para === "remoto") return ok(marcarPulo(atual), [pulado]);
  return ok(marcarPulo(atual), [
    pulado,
    { tipo: "falta", ...ids, motivo: "não compareceu à chamada" },
    { tipo: "saiu_da_fila", ...ids },
  ]);
}

/**
 * RN-EST-05: não fecha com paciente chamado (de qualquer sessão); finalize ou marque "Não compareceu".
 * Como as ações vizinhas, só com a sessão aberta (m5).
 */
export function fecharEstacao(dia: DiaSessao, cmd: Cmd): Resultado<DiaSessao> {
  if (dia.estado !== "aberta") return falha("sessao_fechada");
  const estacao = dia.estacoes.find((e) => e.id === cmd.estacaoId);
  if (!estacao) return falha("transicao_proibida");
  if (estacao.chamadoItemId !== null) return falha("estacao_com_chamado");
  return ok(comEstacao(dia, estacao.id, { aberta: false }));
}

/**
 * AD-006: a tolerância é só um contador desde a chamada (Rechamar não reinicia); esgotada,
 * a estação avisa, mas ninguém é pulado sozinho.
 */
export function toleranciaEsgotada(dia: DiaSessao, estacaoId: string, agora: number): boolean {
  const achado = chamadoNaEstacao(dia, estacaoId);
  if (!achado.ok) return false;
  const ultima = dia.chamadas.findLast((c) => c.itemId === achado.item.id && c.etapa === achado.item.etapa);
  if (!ultima) return false;
  return agora - ultima.em >= dia.config.toleranciaMin * MIN;
}
