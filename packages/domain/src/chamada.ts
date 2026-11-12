import { type EstadoItem, TRANSICOES_ITEM, transicionar } from "./contratos.ts";
import { type DiaSessao, type Estacao, elegiveis, ficarElegivel, type ItemFila } from "./fila.ts";
import { type Evento, falha, ok, type Resultado } from "./resultado.ts";

type Cmd = { estacaoId: string };

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
 * Encerra o chamado como atendido na etapa (RN-CHAM-02). Da triagem, entra presente no atendimento
 * com a mesma senha e o mesmo número, sem regra de atraso (RN-TRI-04).
 */
function encerrar(dia: DiaSessao, estacao: Estacao, item: ItemFila, agora: number): { dia: DiaSessao; evento: Evento } {
  if (transicionar(TRANSICOES_ITEM, item.estado, EVENTO_ENCERRAR) !== "atendido_na_etapa") {
    throw new Error(`contrato: ${item.estado} não encerra`);
  }
  const atendidoEmEtapas = [...item.atendidoEmEtapas, item.etapa];
  const proximaEtapa = item.etapa === "triagem" ? ("atendimento" as const) : null;
  const evento: Evento = {
    tipo: "atendido",
    ...base(dia, item, estacao.id),
    dados: { etapa: item.etapa, proximaEtapa, em: agora },
  };
  const livre = comEstacao(dia, estacao.id, { chamadoItemId: null });
  if (proximaEtapa === null) {
    return { dia: comItem(livre, { ...item, estado: "atendido_na_etapa", atendidoEmEtapas }), evento };
  }
  const naProxima = comItem(livre, { ...item, etapa: proximaEtapa, atendidoEmEtapas, saiuEm: null });
  return { dia: ficarElegivel(naProxima, item.id, agora, { aplicarAtraso: false }).estado, evento };
}

/**
 * RN-CHAM-01/02: encerra o chamado anterior desta estação e chama o 1º elegível dela.
 * Sem elegível (ou estação fechada), `nenhum_elegivel` sem mudar nada, nem o chamado anterior
 * (Review Focus 2); use `finalizar`. A seleção usa o estado recebido: uma 2ª estação chamando
 * sobre o estado devolvido pela 1ª não pega o mesmo paciente (INV-04).
 */
export function chamarProximo(dia: DiaSessao, cmd: Cmd, agora: number): Resultado<DiaSessao> {
  if (dia.estado !== "aberta") return falha("sessao_fechada");
  const estacao = dia.estacoes.find((e) => e.id === cmd.estacaoId);
  if (!estacao?.aberta) return falha("nenhum_elegivel");
  const anterior = estacao.chamadoItemId ? dia.itens.find((i) => i.id === estacao.chamadoItemId) : undefined;
  // Chamado de outra sessão em aberto nesta estação: não é derrubado.
  if (estacao.chamadoItemId !== null && anterior === undefined) return falha("estacao_ocupada");

  let atual = dia;
  const eventos: Evento[] = [];
  if (anterior?.estado === "chamado") {
    const fechado = encerrar(atual, estacao, anterior, agora);
    atual = fechado.dia;
    eventos.push(fechado.evento);
  }
  const proximo = elegiveis(atual, estacao.id)[0];
  if (!proximo) return falha("nenhum_elegivel");
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
  return ok(dia, [
    { tipo: "rechamado", ...base(dia, achado.item, cmd.estacaoId), dados: { senha: achado.item.senha, em: agora } },
  ]);
}

/** RN-CHAM-02: encerra o atendimento atual sem chamar outro. */
export function finalizar(dia: DiaSessao, cmd: Cmd, agora: number): Resultado<DiaSessao> {
  const achado = chamadoNaEstacao(dia, cmd.estacaoId);
  if (!achado.ok) return falha(achado.erro);
  const fechado = encerrar(dia, achado.estacao, achado.item, agora);
  return ok(fechado.dia, [fechado.evento]);
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

  if (para === "presente") {
    const eleg = ficarElegivel(comItem(livre, { ...item, pulos }), item.id, agora, { aplicarAtraso: false });
    return ok(eleg.estado, [pulado]);
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
  if (para === "remoto") return ok(atual, [pulado]);
  return ok(atual, [
    pulado,
    { tipo: "falta", ...ids, motivo: "não compareceu à chamada" },
    { tipo: "saiu_da_fila", ...ids },
  ]);
}

/** RN-EST-05: não fecha com paciente chamado (de qualquer sessão); finalize ou marque "Não compareceu". */
export function fecharEstacao(dia: DiaSessao, cmd: Cmd): Resultado<DiaSessao> {
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
