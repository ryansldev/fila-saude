import {
  type EstadoEntrada,
  type EstadoItem,
  TRANSICOES_ENTRADA,
  TRANSICOES_ITEM,
  TRANSICOES_SESSAO,
  type Transicao,
  transicionar,
} from "./contratos.ts";
import { chamadasQuePassamAVez, type DiaSessao, emContingencia, type ItemFila, type MotivoSaida } from "./fila.ts";
import { type Entrada, type Origem, outraDataNaSessao, type Saida, type Servico, type SessaoVagas } from "./lista.ts";
import { type Evento, falha, ok, type Resultado } from "./resultado.ts";
import { comAbertura, desocupar, itemCriado, jaNaSessao, ocupar, porNaFila, situacao, temVaga } from "./sessao.ts";
import { mesmoDia } from "./tempo.ts";

export type { Origem } from "./lista.ts";

// Eventos das tabelas de transição (textos copiados das specs).
const SESSAO_ENCERRA = "Encerra";
const SESSAO_CANCELA = "Cancela";
const ITEM_ENCERRADA = "Sessão encerrada";
const ITEM_CANCELADA = "Sessão cancelada";
const ITEM_PACIENTE_CANCELA = "Paciente cancela";
const ITEM_INSCRICAO = "Inscrição pública com a sessão aberta, ou vaga da reserva";
const ENTRADA_ANTES_DA_VEZ = "Sessão cancelada, ou encerrada antes da vez";
const ENTRADA_ENCERRADA_SEM_FALTA =
  "Sessão encerrada com o paciente presente, já atendido em etapa anterior ou com a vez passada em contingência";
const ENTRADA_FALTA = "3º pulo, ou falta no encerramento";
const ENTRADA_RESERVA_FECHA = "Sessão encerrada ou cancelada sem vaga para ele";
const ENTRADA_FALTA_APAGADA =
  "Período de contingência registrado depois do encerramento, no mesmo dia, cobrindo a vez dele";
const ENTRADA_DESISTIR = '"Desistir"';
const ENTRADA_PACIENTE_CANCELA = "Paciente cancela";
const ENTRADA_NAO_VOU = 'Paciente cancela ("Não vou poder ir")';
const ENTRADA_DESMARCA_REGULADO = "Paciente desmarca ou desiste";
const ENTRADA_CONCLUIDA = "Atendida na última etapa";
const ENTRADA_NAO_CONFERIU = "Recepção: identidade não confere (RN-FILA-05)";
const ENTRADA_ESCOLHE = "Escolhe ocorrência pública do serviço";
const ENTRADA_ESCOLHE_LOTADA = "Escolhe ocorrência pública lotada";
const ENTRADA_ESCOLHE_SEGURA = "Escolhe ocorrência com vaga, sem foto aceita em serviço com requisição";

/** Destino da única linha (de, evento) que passa no filtro; `null` sem linha única (transição proibida). */
function linhaUnica<S extends string>(
  tabela: Transicao<S>[],
  de: S,
  evento: string,
  filtro: (t: Transicao<S>) => boolean = () => true,
): S | null {
  const linhas = tabela.filter((t) => t.de === de && t.evento === evento && filtro(t));
  const [linha] = linhas;
  if (!linha || linhas.length > 1 || linha.para === "(mesmo)" || linha.para === "(não cria)") return null;
  return linha.para;
}

/** Destino que o contrato garante (erro de programação se faltar a linha). */
function garantido<S extends string>(
  tabela: Transicao<S>[],
  de: S,
  evento: string,
  filtro?: (t: Transicao<S>) => boolean,
): S {
  const para = linhaUnica(tabela, de, evento, filtro);
  if (para === null) throw new Error(`contrato: sem linha única para "${de}" com "${evento}"`);
  return para;
}

/** RN-REM-03: a origem do remanejado vem do serviço (regulado) e da visibilidade da sessão. */
export function origemDaSessao(sessao: SessaoVagas, servico: Servico): Origem {
  if (servico.modo === "regulado") return "regulada";
  return sessao.visibilidade === "publica" ? "publica" : "privada";
}

/**
 * RN-REM-04: remanejada mantém risco, prioridade e data original; perde a sessão. DECISÃO: um
 * novo prejuízo pela unidade dá a origem desta sessão e zera as recusas (preferência renovada).
 */
const remanejar = (e: Entrada, estado: EstadoEntrada, origem: Origem): Entrada => ({
  ...e,
  estado,
  remanejada: origem,
  recusas: 0,
  sessaoId: null,
  alocadaEm: null,
});

const ITEM_FINAL: EstadoItem[] = ["atendido_na_etapa", "saiu_da_fila", "remanejado"];

/** Item ainda na fila (não final). */
const naFila = (i: ItemFila): boolean => !ITEM_FINAL.includes(i.estado);

type Desfecho = "remanejado" | "falta";

/**
 * RN-SES-02, RN-FALTA-01, AD-041, RN-CONT-03: desfecho de quem está na fila ao encerrar e a
 * linha do contrato do item. Presente nunca leva falta; remoto com a vez passada (na etapa
 * atual, enquanto estava fora) leva, exceto se já foi atendido numa etapa do dia ou se todas as
 * chamadas que passaram a vez dele foram feitas em contingência registrada.
 */
function desfechoNoEncerramento(dia: DiaSessao, x: ItemFila): { desfecho: Desfecho; condicao: string } {
  const passaram = chamadasQuePassamAVez(dia, x);
  if (passaram.length === 0) return { desfecho: "remanejado", condicao: "A vez não passou" };
  if (x.estado === "presente") return { desfecho: "remanejado", condicao: "A vez passou" };
  if (x.atendidoEmEtapas.length > 0) return { desfecho: "remanejado", condicao: "Já atendido em etapa anterior" };
  if (passaram.every((c) => emContingencia(dia, c.em))) {
    return { desfecho: "remanejado", condicao: "A vez passou durante período de contingência registrado" };
  }
  return { desfecho: "falta", condicao: "A vez passou; nunca atendido no dia; fora de contingência" };
}

/** Linha do contrato da entrada para cada motivo de saída que só a fila do dia produz. */
const EVENTO_DO_MOTIVO: Partial<Record<MotivoSaida, string>> = {
  pulos: ENTRADA_FALTA,
  falta: ENTRADA_FALTA,
  nao_conferiu: ENTRADA_NAO_CONFERIU,
};

/**
 * Mapeamento único do desfecho do item na fila do dia para a entrada "Na fila" (contrato de
 * Entrada): atendido na última etapa → Concluída; 3º pulo (ou falta no encerramento) → Encerrada
 * sem atendimento, e a pessoa pode criar entrada nova (RN-CHAM-03); identidade não confere →
 * Cancelada (RN-FILA-05). Chame depois de `finalizar`/`chamarProximo`, `naoCompareceu` e
 * `conferirEMarcar` quando o item ficar final; `encerrar` e `cancelar` aplicam a quem faltou.
 * Remanejado, cancelamento e remoção mudam a entrada na própria ação: aqui são recusados.
 */
export function desfechoDaEntrada(entrada: Entrada, item: ItemFila): Resultado<Entrada> {
  if (entrada.estado !== "na_fila" || item.entradaId !== entrada.id) return falha("transicao_proibida");
  let evento: string | undefined;
  if (item.estado === "atendido_na_etapa" && item.etapa === "atendimento") evento = ENTRADA_CONCLUIDA;
  else if (item.estado === "saiu_da_fila" && item.motivoSaida !== null) evento = EVENTO_DO_MOTIVO[item.motivoSaida];
  if (evento === undefined) return falha("transicao_proibida");
  const para = garantido(TRANSICOES_ENTRADA, entrada.estado, evento);
  const ids = {
    entradaId: entrada.id,
    itemId: item.id,
    ...(entrada.sessaoId === null ? {} : { sessaoId: entrada.sessaoId }),
  };
  const eventos: Evento[] =
    para === "cancelada" ? [{ tipo: "cancelada", ...ids, motivo: "identidade não confere" }] : [];
  return ok({ ...entrada, estado: para }, eventos);
}

/** Entrada "Na fila" cujo item já é final: aplica o desfecho; sem desfecho, fica como está. */
function fecharComDesfecho(e: Entrada, dia: DiaSessao, eventos: Evento[]): Entrada {
  const item = dia.itens.find((i) => i.entradaId === e.id);
  if (e.estado !== "na_fila" || item === undefined) return e;
  const r = desfechoDaEntrada(e, item);
  if (!r.ok) return e;
  eventos.push(...r.eventos);
  return r.estado;
}

type DiaEEntradas = { dia: DiaSessao; entradas: Entrada[] };

/**
 * RN-SES-01..04: o admin encerra a sessão aberta, sem estação com paciente chamado. Cada um ainda
 * na fila vira remanejado ou leva falta (RN-SES-02); a reserva é cancelada. Entrada ainda "Na
 * fila" cujo item já teve desfecho no dia é fechada por `desfechoDaEntrada`. Sinal perdido sem
 * contingência registrada só gera o aviso (RN-SES-04). `entradas` são as da sessão; `origem`
 * vem de `origemDaSessao`.
 */
export function encerrar(
  dia: DiaSessao,
  entradas: Entrada[],
  agora: number,
  opcoes: { semSinalSemContingencia: boolean; origem: Origem },
): Resultado<DiaEEntradas> & { aviso?: "sinal_perdido" } {
  if (transicionar(TRANSICOES_SESSAO, dia.estado, SESSAO_ENCERRA) !== "encerrada") return falha("transicao_proibida");
  if (dia.estacoes.some((e) => e.chamadoItemId !== null) || dia.itens.some((i) => i.estado === "chamado")) {
    return falha("estacao_com_chamado");
  }

  const eventos: Evento[] = [];
  const faltas: string[] = [];
  const porEntrada = new Map<string, { desfecho: Desfecho; condicao: string }>();
  const itens = dia.itens.map((x) => {
    if (!naFila(x)) return x;
    const { desfecho, condicao } = desfechoNoEncerramento(dia, x);
    const para = garantido(TRANSICOES_ITEM, x.estado, ITEM_ENCERRADA, (t) => t.condicao === condicao);
    porEntrada.set(x.entradaId, { desfecho, condicao });
    const ids = { itemId: x.id, entradaId: x.entradaId, sessaoId: dia.sessaoId };
    if (desfecho === "falta") {
      faltas.push(x.id);
      eventos.push({ tipo: "falta", ...ids, motivo: "vez passou no encerramento" }, { tipo: "saiu_da_fila", ...ids });
    } else {
      eventos.push({ tipo: "remanejado", ...ids, motivo: condicao });
    }
    return { ...x, estado: para, travadoAtras: [], motivoSaida: desfecho === "falta" ? ("falta" as const) : null };
  });

  const novas = entradas.map((e) => {
    if (e.sessaoId !== dia.sessaoId) return e;
    if (e.estado === "na_reserva") {
      eventos.push({ tipo: "cancelada", entradaId: e.id, sessaoId: dia.sessaoId, motivo: "sessão encerrada" });
      return { ...e, estado: garantido(TRANSICOES_ENTRADA, e.estado, ENTRADA_RESERVA_FECHA) };
    }
    const fim = porEntrada.get(e.id);
    if (e.estado !== "na_fila") return e;
    if (fim === undefined) return fecharComDesfecho(e, dia, eventos);
    const evento =
      fim.desfecho === "falta"
        ? ENTRADA_FALTA
        : fim.condicao === "A vez não passou"
          ? ENTRADA_ANTES_DA_VEZ
          : ENTRADA_ENCERRADA_SEM_FALTA;
    const para = garantido(TRANSICOES_ENTRADA, e.estado, evento);
    return fim.desfecho === "falta" ? { ...e, estado: para } : remanejar(e, para, opcoes.origem);
  });

  const encerrado: DiaSessao = {
    ...dia,
    estado: "encerrada",
    itens,
    encerramento: { em: agora, faltas, origem: opcoes.origem },
  };
  const r = ok<DiaEEntradas>({ dia: encerrado, entradas: novas }, eventos);
  return opcoes.semSinalSemContingencia ? { ...r, aviso: "sinal_perdido" } : r;
}

/**
 * Fluxo de cancelamento de sessão (excecoes, tabela de Sessão): planejada ou aberta. Entradas não
 * finais da sessão, inclusive a chamada no momento, viram remanejadas; "Na reserva" é cancelada.
 * Cancelamento nunca gera falta; quem já teve desfecho no dia (atendido, 3º pulo, não conferiu)
 * não é remanejado: a entrada vai à linha desse desfecho (`desfechoDaEntrada`).
 */
export function cancelar(
  dia: DiaSessao,
  entradas: Entrada[],
  agora: number,
  opcoes: { origem: Origem },
): Resultado<DiaEEntradas> {
  if (transicionar(TRANSICOES_SESSAO, dia.estado, SESSAO_CANCELA) !== "cancelada") return falha("transicao_proibida");
  const eventos: Evento[] = [];
  const itens = dia.itens.map((x) => {
    if (!naFila(x)) return x;
    return { ...x, estado: garantido(TRANSICOES_ITEM, x.estado, ITEM_CANCELADA), travadoAtras: [] };
  });
  const remanejaveis: EstadoEntrada[] = ["alocada", "confirmada", "aguardando_encaminhamento", "na_fila"];
  const novas = entradas.map((e) => {
    if (e.sessaoId !== dia.sessaoId) return e;
    const ids = { entradaId: e.id, sessaoId: dia.sessaoId };
    if (e.estado === "na_reserva") {
      eventos.push({ tipo: "cancelada", ...ids, motivo: "sessão cancelada" });
      return { ...e, estado: garantido(TRANSICOES_ENTRADA, e.estado, ENTRADA_RESERVA_FECHA) };
    }
    if (!remanejaveis.includes(e.estado)) return e;
    const item = dia.itens.find((i) => i.entradaId === e.id);
    if (item !== undefined && !naFila(item)) return fecharComDesfecho(e, dia, eventos);
    const para = garantido(TRANSICOES_ENTRADA, e.estado, ENTRADA_ANTES_DA_VEZ);
    eventos.push({ tipo: "remanejado", ...ids, ...(item ? { itemId: item.id } : {}), motivo: "sessão cancelada" });
    return remanejar(e, para, opcoes.origem);
  });
  const cancelado: DiaSessao = {
    ...dia,
    estado: "cancelada",
    itens,
    estacoes: dia.estacoes.map((s) => (s.chamadoItemId === null ? s : { ...s, chamadoItemId: null })),
  };
  return ok({ dia: cancelado, entradas: novas }, [
    ...eventos,
    { tipo: "cancelada", sessaoId: dia.sessaoId, dados: { em: agora } },
  ]);
}

/**
 * RN-CONT-02/03: a recepção registra um período de contingência já terminado. Na sessão aberta,
 * o período passa a valer na regra de atraso e no encerramento. Na sessão encerrada, se o registro
 * é no mesmo dia do encerramento (fuso da unidade), as faltas do encerramento cuja vez passou só
 * dentro de contingência são apagadas e viram remanejadas (única reversão de estado final).
 */
export function registrarContingencia(
  dia: DiaSessao,
  entradas: Entrada[],
  periodo: { inicio: number; fim: number; motivo: string },
  agora: number,
): Resultado<DiaEEntradas> {
  if (dia.estado === "planejada") return falha("transicao_proibida");
  // DECISÃO: período só depois de terminado (fim ≤ agora), registrado "na volta" (RN-CONT-02).
  if (!(periodo.inicio < periodo.fim) || periodo.fim > agora) return falha("transicao_proibida");
  const comPeriodo: DiaSessao = { ...dia, contingencias: [...dia.contingencias, { ...periodo }] };
  const enc = dia.encerramento;
  if (dia.estado !== "encerrada" || enc === undefined || !mesmoDia(agora, enc.em, dia.config.fuso)) {
    return ok({ dia: comPeriodo, entradas });
  }

  const eventos: Evento[] = [];
  // Só apaga a falta com a entrada dela em mãos, encerrada sem atendimento por falta nesta sessão.
  const apagadas = new Map<string, Entrada>();
  for (const itemId of enc.faltas) {
    const x = dia.itens.find((i) => i.id === itemId);
    const e = x && entradas.find((en) => en.id === x.entradaId && en.sessaoId === dia.sessaoId);
    if (!x || !e) continue;
    const para = linhaUnica(TRANSICOES_ENTRADA, e.estado, ENTRADA_FALTA_APAGADA);
    if (para === null) continue;
    // Recalcula como no encerramento: o item estava remoto, nunca atendido.
    const passaram = chamadasQuePassamAVez(comPeriodo, x);
    if (passaram.length === 0 || !passaram.every((c) => emContingencia(comPeriodo, c.em))) continue;
    apagadas.set(itemId, remanejar(e, para, enc.origem));
    const ids = { itemId, entradaId: e.id, sessaoId: dia.sessaoId };
    eventos.push(
      { tipo: "falta_apagada", ...ids, motivo: periodo.motivo },
      { tipo: "remanejado", ...ids, motivo: "contingência registrada" },
    );
  }
  // DECISÃO: o item volta ao desfecho que o encerramento daria (remanejado), para a fila do dia
  // mostrar o mesmo que a entrada; o contrato do item não tem linha de reversão própria.
  const paraItem = garantido(TRANSICOES_ITEM, "remoto", ITEM_ENCERRADA, (t) => t.spec === "contingencia");
  const itens = comPeriodo.itens.map((i) => (apagadas.has(i.id) ? { ...i, estado: paraItem } : i));
  const novaDe = new Map([...apagadas.values()].map((e) => [e.id, e]));
  const novas = entradas.map((e) => novaDe.get(e.id) ?? e);
  const recalculado: DiaSessao = {
    ...comPeriodo,
    itens,
    encerramento: { ...enc, faltas: enc.faltas.filter((f) => !apagadas.has(f)) },
  };
  return ok({ dia: recalculado, entradas: novas }, eventos);
}

/**
 * RN-ID-06, AD-040: em quem fica a falta. Lançado regulado: na pessoa (CPF da regulação). Pessoa
 * conferida na unidade: nela. Senão, no responsável que marcou, se a conta dele é verificada;
 * conta não verificada ou pessoa local sem conta: em ninguém.
 */
export function titularDaFalta(
  entrada: Entrada,
  conferida: boolean,
  responsavelVerificado: boolean,
  lancada: boolean,
): "pessoa" | "responsavel" | "ninguem" {
  if (lancada || conferida) return "pessoa";
  return entrada.responsavelId !== null && responsavelVerificado ? "responsavel" : "ninguem";
}

/**
 * Tira da fila do dia o item da entrada "Na fila" (o "Paciente cancela" do item), a partir dos
 * estados aceitos. Fora da fila, devolve o dia como veio.
 */
function sairDaFila(
  entrada: Entrada,
  dia: DiaSessao | null,
  aceitos: EstadoItem[],
): { ok: true; dia: DiaSessao | null } | { ok: false } {
  if (entrada.estado !== "na_fila") return { ok: true, dia };
  if (dia === null || dia.sessaoId !== entrada.sessaoId || dia.estado !== "aberta") return { ok: false };
  const x = dia.itens.find((i) => i.entradaId === entrada.id);
  if (!x || !aceitos.includes(x.estado)) return { ok: false };
  if (transicionar(TRANSICOES_ITEM, x.estado, ITEM_PACIENTE_CANCELA) !== "saiu_da_fila") return { ok: false };
  return {
    ok: true,
    dia: {
      ...dia,
      itens: dia.itens.map((i) =>
        i.id === x.id
          ? { ...i, estado: "saiu_da_fila" as const, travadoAtras: [], motivoSaida: "cancelou" as const }
          : { ...i, travadoAtras: i.travadoAtras.filter((t) => t !== x.id) },
      ),
    },
  };
}

/**
 * RN-REM-03, AD-045: "Outra data" do remanejado com data na sessão `sessao` (confirmada, alocada,
 * vaga segura ou na fila ainda remoto; `dia` = o da sessão, se aberta). Só em sessão privada ou
 * regulada. 1ª vez: continua remanejado, com a preferência. 2ª (só confirmada ou alocada): privada
 * volta à lista com a data original; pública e regulada são encerradas com aviso. Devolve `Saida`
 * (sessão já liberada). É a entrada do app para qualquer remanejada com data, inclusive alocada;
 * a regra (`outraDataNaSessao`, lista.ts) é a mesma de `recusar`.
 */
export function outraData(
  entrada: Entrada,
  sessao: SessaoVagas,
  agora: number,
  dia: DiaSessao | null = null,
): Resultado<Saida> {
  const r = outraDataNaSessao(entrada, sessao, agora);
  if (!r.ok) return r;
  const saida = sairDaFila(entrada, dia, ["remoto"]);
  if (!saida.ok) return falha("transicao_proibida");
  return ok({ ...r.estado, dia: saida.dia }, r.eventos);
}

/**
 * RN-REM-03: "Desistir" cancela de vez. Com data (confirmada, alocada, vaga segura ou na fila), a
 * vaga de `sessao` (a da entrada) é liberada e devolvida em `Saida`; aguardando remarcação, é o
 * cancelamento do paciente e `sessao` é `null`. Em serviço regulado, o agendador é avisado para
 * comunicar a regulação.
 */
export function desistir(
  entrada: Entrada,
  sessao: SessaoVagas | null,
  agora: number,
  dia: DiaSessao | null = null,
): Resultado<Saida<SessaoVagas | null>> {
  const origem = entrada.remanejada;
  if (origem === null) return falha("transicao_proibida");
  const semData = entrada.estado === "remanejada";
  if (semData ? sessao !== null : sessao === null || entrada.sessaoId !== sessao.id) {
    return falha("transicao_proibida");
  }
  const para = linhaUnica(TRANSICOES_ENTRADA, entrada.estado, semData ? ENTRADA_PACIENTE_CANCELA : ENTRADA_DESISTIR);
  if (para !== "cancelada") return falha("transicao_proibida");
  const saida = sairDaFila(entrada, dia, ["remoto", "presente"]);
  if (!saida.ok) return falha("transicao_proibida");

  const ids = { entradaId: entrada.id, ...(entrada.sessaoId === null ? {} : { sessaoId: entrada.sessaoId }) };
  const eventos: Evento[] = [];
  if (!semData) eventos.push({ tipo: "vaga_liberada", ...ids });
  eventos.push({
    tipo: "cancelada",
    ...ids,
    ...(origem === "regulada" ? { motivo: "comunicar a regulação" } : {}),
    dados: { desistiu: true, em: agora },
  });
  return ok(
    {
      entrada: { ...entrada, estado: para, remanejada: null, sessaoId: null, alocadaEm: null },
      sessao: sessao === null ? null : desocupar(sessao),
      dia: saida.dia,
    },
    eventos,
  );
}

/** Estados em que a entrada ocupa uma vaga da sessão (INV-02); "Na reserva" não ocupa. */
const COM_VAGA: EstadoEntrada[] = ["alocada", "confirmada", "na_fila"];

/**
 * RN-CANC-01/02/03: o paciente cancela ("Não vou poder ir") a entrada não remanejada (remanejada
 * usa `desistir`). Na lista (aguardando, aguardando encaminhamento) ou na reserva, só cancela;
 * com vaga (alocada, confirmada, vaga segura ou na fila, remoto ou presente), libera a vaga da
 * `sessao` (a da entrada) e tira o item da fila do dia, devolvendo `Saida`; depois, chame
 * `preencherDaReserva`. Em serviço regulado (lançado) é "Paciente desmarca ou desiste": vaga sem
 * sugestão e o agendador avisado para comunicar a regulação. Quem cancela faz entrada nova.
 */
export function cancelarEntrada(
  entrada: Entrada,
  sessao: SessaoVagas | null,
  dia: DiaSessao | null,
  cmd: { servico: Servico },
  agora: number,
): Resultado<Saida<SessaoVagas | null>> {
  const { servico } = cmd;
  if (entrada.remanejada !== null || servico.id !== entrada.servicoId) return falha("transicao_proibida");
  const regulado = servico.modo === "regulado";
  const comVaga =
    COM_VAGA.includes(entrada.estado) || (entrada.estado === "aguardando_encaminhamento" && entrada.sessaoId !== null);
  if (comVaga ? sessao === null || entrada.sessaoId !== sessao.id : sessao !== null) {
    return falha("transicao_proibida");
  }
  const evento = regulado
    ? ENTRADA_DESMARCA_REGULADO
    : COM_VAGA.includes(entrada.estado)
      ? ENTRADA_NAO_VOU
      : ENTRADA_PACIENTE_CANCELA;
  const para = linhaUnica(TRANSICOES_ENTRADA, entrada.estado, evento);
  if (para !== "cancelada") return falha("transicao_proibida");
  const saida = sairDaFila(entrada, dia, ["remoto", "presente"]);
  if (!saida.ok) return falha("transicao_proibida");

  const ids = { entradaId: entrada.id, ...(entrada.sessaoId === null ? {} : { sessaoId: entrada.sessaoId }) };
  const eventos: Evento[] = [];
  if (comVaga) eventos.push({ tipo: "vaga_liberada", ...ids, ...(regulado ? { motivo: "sem sugestão" } : {}) });
  eventos.push({
    tipo: "cancelada",
    ...ids,
    ...(regulado ? { motivo: "comunicar a regulação" } : {}),
    dados: { em: agora },
  });
  return ok(
    {
      entrada: { ...entrada, estado: para, sessaoId: null, alocadaEm: null },
      sessao: sessao === null ? null : desocupar(sessao),
      dia: saida.dia,
    },
    eventos,
  );
}

/**
 * RN-REM-05, AD-031: o remanejado de sessão pública escolhe uma ocorrência pública do serviço.
 * Com vaga: confirmado (na fila remota com o próximo número, se já abriu); sem a foto aceita em
 * serviço com requisição, vaga segura só antes da abertura. Lotada: topo da reserva, sem ocupar
 * vaga e sem tirar ninguém (INV-10). Mantém a origem, para o topo da reserva.
 */
export function escolherData(
  entrada: Entrada,
  sessao: SessaoVagas,
  dia: DiaSessao | null,
  cmd: { servico: Servico; fotoAceita: boolean },
  agora: number,
): Resultado<{ entrada: Entrada; sessao: SessaoVagas; dia: DiaSessao | null }> {
  if (entrada.estado !== "remanejada" || entrada.remanejada !== "publica") return falha("transicao_proibida");
  if (
    sessao.visibilidade !== "publica" ||
    sessao.servicoId !== entrada.servicoId ||
    cmd.servico.id !== entrada.servicoId
  ) {
    return falha("transicao_proibida");
  }
  const sit = situacao(dia, sessao);
  if (!sit.ok) return falha(sit.erro);
  if (jaNaSessao(dia, entrada.id)) return falha("duplicada");

  const ids = { entradaId: entrada.id, sessaoId: sessao.id };
  if (!temVaga(sessao)) {
    const para = garantido(TRANSICOES_ENTRADA, entrada.estado, ENTRADA_ESCOLHE_LOTADA);
    return ok({ entrada: { ...entrada, estado: para, sessaoId: sessao.id }, sessao, dia }, [
      { tipo: "na_reserva", ...ids, motivo: "remanejada: topo da reserva", dados: { em: agora } },
    ]);
  }
  const fotoOk = cmd.servico.modo !== "requisicao" || cmd.fotoAceita;
  if (!fotoOk && sit.aberta) return falha("requisicao_pendente");
  const para = comAbertura(
    garantido(TRANSICOES_ENTRADA, entrada.estado, fotoOk ? ENTRADA_ESCOLHE : ENTRADA_ESCOLHE_SEGURA),
    sit.aberta,
  );
  const nova: Entrada = { ...entrada, estado: para, sessaoId: sessao.id };
  const eventos: Evento[] = [{ tipo: "inscrita", ...ids, motivo: "remanejada", dados: { estado: para } }];
  let novoDia = dia;
  if (para === "na_fila" && dia !== null) {
    const r = porNaFila(dia, nova, itemCriado(ITEM_INSCRICAO), agora);
    novoDia = r.dia;
    eventos.push(...r.eventos);
  }
  return ok({ entrada: nova, sessao: ocupar(sessao), dia: novoDia }, eventos);
}
