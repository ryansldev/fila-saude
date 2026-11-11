import {
  type EstadoEntrada,
  type EstadoItem,
  TRANSICOES_ENTRADA,
  TRANSICOES_ITEM,
  TRANSICOES_SESSAO,
  transicionar,
} from "./contratos.ts";
import { CONFIG_PADRAO, type DiaSessao, ficarElegivel, type ItemFila } from "./fila.ts";
import {
  criarEntrada,
  destinoPorCondicao,
  type Entrada,
  entradaAtivaDa,
  type Pessoa,
  pendentesNaAbertura,
  riscoVigente,
  type Servico,
  type SessaoVagas,
} from "./lista.ts";
import { prioridadeDaPessoa, temPrioridade } from "./prioridade.ts";
import { type CodigoErro, type Evento, falha, ok, type Resultado } from "./resultado.ts";
import type { ConfigUnidade, NivelRisco, Respostas } from "./tipos.ts";

// Eventos das tabelas de transição (textos copiados das specs).
const SESSAO_ABRE = "Horário de início chega, ou admin abre antes";
const ENTRADA_SESSAO_ABRE = "Sessão abre";
const ENTRADA_SEM_ACEITE = "Sessão abre sem aceite";
const ENTRADA_INSCRICAO = "Inscrição pública";
const ENTRADA_DA_RESERVA = "Vaga liberada e é o primeiro da reserva";
const ENTRADA_TROCA = "Troca por vaga em outra sessão pública do serviço";
const ENTRADA_TROCA_SEGURA = "Troca por vaga em serviço com requisição, sem foto aceita";
const ENTRADA_ACEITA = "Agendador aceita";
const ENTRADA_LANCA = "Agendador lança (serviço regulado)";
const ENTRADA_REMOVE = "Agendador remove lançamento, com motivo";
const ITEM_SESSAO_ABRE = "Sessão abre";
const ITEM_INSCRICAO = "Inscrição pública com a sessão aberta, ou vaga da reserva";
const ITEM_LANCA = "Agendador lança paciente regulado com a sessão aberta";
const ITEM_BALCAO = "Recepção inclui no balcão";
const ENTRADA_BALCAO = "Recepção inclui no balcão";
const ITEM_REMOVE = "Agendador remove lançamento";

/** Id do item da fila de uma entrada na sessão: um por entrada e sessão, determinístico. */
export const idDoItem = (entradaId: string, sessaoId: string): string => `${sessaoId}/${entradaId}`;

/** RN-FILA-04: prefixo do serviço e número com 3 dígitos (ex.: "C-012"). */
export const senhaDe = (prefixo: string, numero: number): string => `${prefixo}-${String(numero).padStart(3, "0")}`;

/** INV-02: a sessão ainda tem vaga (`null` = sem limite). "Na reserva" não ocupa. */
const temVaga = (s: SessaoVagas): boolean => s.vagas === null || s.ocupadas < s.vagas;

const ocupar = (s: SessaoVagas): SessaoVagas => ({ ...s, ocupadas: s.ocupadas + 1 });
const desocupar = (s: SessaoVagas): SessaoVagas => ({ ...s, ocupadas: Math.max(0, s.ocupadas - 1) });

/** Estado do item na linha de criação ("—") do contrato da fila do dia. */
function itemCriado(evento: string): EstadoItem {
  const linhas = TRANSICOES_ITEM.filter((t) => t.de === "—" && t.evento === evento);
  const [linha] = linhas;
  if (!linha || linhas.length > 1 || linha.para === "(mesmo)" || linha.para === "(não cria)") {
    throw new Error(`contrato: sem linha única de criação de item para "${evento}"`);
  }
  return linha.para;
}

/** Destino de linha com condição; o contrato garante que existe. */
function destino(
  de: EstadoEntrada | "—",
  evento: string,
  filtro: Parameters<typeof destinoPorCondicao>[2],
): EstadoEntrada {
  const para = destinoPorCondicao(de, evento, filtro);
  if (para === null || para === "(mesmo)") throw new Error(`contrato: "${evento}" sem estado de destino`);
  return para;
}

/** "Confirmada (ou Na fila, se a sessão já abriu)": a qualificação da célula "Para" das specs. */
const comAbertura = (para: EstadoEntrada, aberta: boolean): EstadoEntrada =>
  para === "confirmada" && aberta ? "na_fila" : para;

type Situacao = { ok: true; aberta: boolean } | { ok: false; erro: CodigoErro };

/** O dia da sessão, se houver: `null` ou planejada = ainda não abriu; encerrada ou cancelada = fechada. */
function situacao(dia: DiaSessao | null, sessao: SessaoVagas): Situacao {
  if (dia === null) return { ok: true, aberta: false };
  if (dia.sessaoId !== sessao.id) return { ok: false, erro: "transicao_proibida" };
  if (dia.estado === "planejada") return { ok: true, aberta: false };
  if (dia.estado === "aberta") return { ok: true, aberta: true };
  return { ok: false, erro: "sessao_fechada" };
}

/**
 * Põe a entrada na fila do dia com o próximo número livre (RN-FILA-02) e a senha dele (RN-FILA-04).
 * Quem entra presente (balcão) fica elegível na hora, com a janela protegida e sem atraso (número novo).
 */
function porNaFila(
  dia: DiaSessao,
  entrada: Entrada,
  estado: EstadoItem,
  agora: number,
): { dia: DiaSessao; eventos: Evento[] } {
  const numero = dia.proximoNumero;
  const item: ItemFila = {
    id: idDoItem(entrada.id, dia.sessaoId),
    entradaId: entrada.id,
    senha: senhaDe(dia.prefixoSenha, numero),
    numero,
    etapa: dia.exigeTriagem ? "triagem" : "atendimento",
    estado,
    pendencias: [],
    urgenciaConfirmada: entrada.riscoConfirmado === "urgente",
    risco: riscoVigente(entrada),
    prioridade: entrada.prioridade,
    pulos: 0,
    travadoAtras: [],
    saiuEm: null,
    atendidoEmEtapas: [],
  };
  // INV-05: o número vem de um contador da sessão, então a senha não se repete.
  if (dia.itens.some((i) => i.entradaId === entrada.id || i.id === item.id || i.senha === item.senha)) {
    throw new Error(`INV-05: entrada ${entrada.id} ou senha ${item.senha} já está na sessão ${dia.sessaoId}`);
  }
  const novo: DiaSessao = { ...dia, itens: [...dia.itens, item], proximoNumero: numero + 1 };
  const eventos: Evento[] = [
    {
      tipo: "senha_emitida",
      itemId: item.id,
      entradaId: entrada.id,
      sessaoId: dia.sessaoId,
      dados: { senha: item.senha, numero },
    },
  ];
  if (estado !== "presente") return { dia: novo, eventos };
  const elegivel = ficarElegivel(novo, item.id, agora, { aplicarAtraso: false });
  return { dia: elegivel.estado, eventos: [...eventos, ...elegivel.eventos] };
}

/** INV-05: a entrada (ou o id dela) já tem item no dia da sessão; ações públicas recusam como duplicada. */
function jaNaSessao(dia: DiaSessao | null, entradaId: string): boolean {
  if (dia === null) return false;
  const itemId = idDoItem(entradaId, dia.sessaoId);
  return dia.itens.some((i) => i.entradaId === entradaId || i.id === itemId);
}

const trocar = (entradas: Entrada[], nova: Entrada): Entrada[] => entradas.map((e) => (e.id === nova.id ? nova : e));

const porData = (a: Entrada, b: Entrada): number =>
  a.dataEntradaOriginal - b.dataEntradaOriginal || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * RN-FILA-01: a sessão abre e as confirmadas dela entram remotas, numeradas pela data de entrada
 * original (alocadas) — na inscrição pública ela é a hora da inscrição. Liberar alocações
 * pendentes e vagas seguras fica com `abrirSessao`.
 */
export function abrir(
  dia: DiaSessao,
  entradas: Entrada[],
  agora: number,
): Resultado<{ dia: DiaSessao; entradas: Entrada[] }> {
  if (transicionar(TRANSICOES_SESSAO, dia.estado, SESSAO_ABRE) !== "aberta") return falha("transicao_proibida");
  const estadoItem = itemCriado(ITEM_SESSAO_ABRE);
  let novo: DiaSessao = { ...dia, estado: "aberta" };
  let novas = entradas;
  const eventos: Evento[] = [];
  const confirmadas = entradas.filter((e) => e.sessaoId === dia.sessaoId && e.estado === "confirmada").sort(porData);
  for (const e of confirmadas) {
    const para = transicionar(TRANSICOES_ENTRADA, e.estado, ENTRADA_SESSAO_ABRE);
    if (para !== "na_fila") throw new Error(`contrato: confirmada não entra na fila na abertura (${para})`);
    const nova: Entrada = { ...e, estado: para };
    const r = porNaFila(novo, nova, estadoItem, agora);
    novo = r.dia;
    novas = trocar(novas, nova);
    eventos.push(...r.eventos);
  }
  return ok({ dia: novo, entradas: novas }, eventos);
}

/** RN-ENC-04: na abertura, vaga segura sem aceite é liberada e a entrada segue aguardando encaminhamento. */
export function vagasSegurasNaAbertura(
  entradas: Entrada[],
  sessao: SessaoVagas,
): Resultado<{ entradas: Entrada[]; sessao: SessaoVagas }> {
  let s = sessao;
  const eventos: Evento[] = [];
  const novas = entradas.map((e) => {
    if (e.estado !== "aguardando_encaminhamento" || e.sessaoId !== sessao.id) return e;
    const para = destino(e.estado, ENTRADA_SEM_ACEITE, (t) => t.qualificador === "vaga segura");
    s = desocupar(s);
    eventos.push({
      tipo: "vaga_liberada",
      entradaId: e.id,
      sessaoId: sessao.id,
      motivo: "sessão abriu sem a requisição aceita",
    });
    return { ...e, estado: para, sessaoId: null };
  });
  return ok({ entradas: novas, sessao: s }, eventos);
}

/** Serviço da sessão e as fotos de requisição já aceitas (ids de entrada). */
export type CmdReserva = { servico: Servico; fotosAceitas: string[] };

/**
 * A sessão abre por inteiro (tabela de Sessão): alocações pendentes (RN-CONF-04) e vagas seguras
 * sem aceite (RN-ENC-04) são liberadas, as confirmadas entram na fila (RN-FILA-01) e as vagas
 * que abriram vão para a reserva (RN-PUB-02), já com a sessão aberta.
 */
export function abrirSessao(
  dia: DiaSessao,
  sessao: SessaoVagas,
  entradas: Entrada[],
  cmd: CmdReserva,
  agora: number,
): Resultado<{ dia: DiaSessao; sessao: SessaoVagas; entradas: Entrada[] }> {
  if (dia.sessaoId !== sessao.id) return falha("transicao_proibida");
  const pendentes = pendentesNaAbertura(entradas, sessao);
  if (!pendentes.ok) return pendentes;
  const seguras = vagasSegurasNaAbertura(pendentes.estado.entradas, pendentes.estado.sessao);
  if (!seguras.ok) return seguras;
  const aberta = abrir(dia, seguras.estado.entradas, agora);
  if (!aberta.ok) return aberta;
  const reserva = preencherDaReserva(seguras.estado.sessao, aberta.estado.dia, aberta.estado.entradas, cmd, agora);
  if (!reserva.ok) return reserva;
  return ok(
    { dia: reserva.estado.dia ?? aberta.estado.dia, sessao: reserva.estado.sessao, entradas: reserva.estado.entradas },
    [...pendentes.eventos, ...seguras.eventos, ...aberta.eventos, ...reserva.eventos],
  );
}

/** Ordem da reserva (RN-PUB-02): remanejados de sessão pública no topo (RN-REM-05), depois por inscrição. */
const ordemReserva = (a: Entrada, b: Entrada): number =>
  Number(a.remanejada === null) - Number(b.remanejada === null) || porData(a, b);

type Vagas = { sessao: SessaoVagas; dia: DiaSessao | null; entradas: Entrada[] };

/**
 * RN-PUB-02: enquanto houver vaga livre, ela vai ao primeiro da reserva, que entra confirmado
 * (na fila, se a sessão já abriu). Sem a foto aceita: antes da abertura, recebe vaga segura
 * (RN-ENC-04); com a sessão aberta, a vaga passa ao próximo. Sessão privada não tem reserva.
 */
export function preencherDaReserva(
  sessao: SessaoVagas,
  dia: DiaSessao | null,
  entradas: Entrada[],
  cmd: CmdReserva,
  agora: number,
): Resultado<Vagas> {
  if (cmd.servico.id !== sessao.servicoId) return falha("transicao_proibida");
  const sit = situacao(dia, sessao);
  if (!sit.ok) return falha(sit.erro);
  if (sessao.visibilidade !== "publica") return ok({ sessao, dia, entradas });

  const exigeFoto = cmd.servico.modo === "requisicao";
  let estado: Vagas = { sessao, dia, entradas };
  const eventos: Evento[] = [];
  const reserva = entradas.filter((e) => e.estado === "na_reserva" && e.sessaoId === sessao.id).sort(ordemReserva);
  for (const e of reserva) {
    if (!temVaga(estado.sessao)) break;
    const fotoOk = !exigeFoto || cmd.fotosAceitas.includes(e.id);
    if (!fotoOk && sit.aberta) continue;
    const para = comAbertura(
      destino(e.estado, ENTRADA_DA_RESERVA, (t) =>
        fotoOk ? t.condicao.startsWith("Foto aceita") : t.condicao.startsWith("Requisição sem foto aceita"),
      ),
      sit.aberta,
    );
    const nova: Entrada = { ...e, estado: para };
    let novoDia = estado.dia;
    const ev: Evento[] = [];
    if (para === "na_fila" && novoDia !== null) {
      const r = porNaFila(novoDia, nova, itemCriado(ITEM_INSCRICAO), agora);
      novoDia = r.dia;
      ev.push(...r.eventos);
    }
    estado = { sessao: ocupar(estado.sessao), dia: novoDia, entradas: trocar(estado.entradas, nova) };
    eventos.push(
      { tipo: "inscrita", entradaId: e.id, sessaoId: sessao.id, motivo: "vaga da reserva", dados: { estado: para } },
      ...ev,
    );
  }
  return ok(estado, eventos);
}

/**
 * Uma vaga ocupada da sessão foi liberada (quem saiu já mudou de estado com o chamador) e vai
 * para a reserva (RN-PUB-02). Quem já desocupou a vaga (ex.: `recusar`) usa `preencherDaReserva`.
 */
export function liberarVaga(
  sessao: SessaoVagas,
  dia: DiaSessao | null,
  entradas: Entrada[],
  cmd: CmdReserva,
  agora: number,
): Resultado<Vagas> {
  return preencherDaReserva(desocupar(sessao), dia, entradas, cmd, agora);
}

/** Dados de quem se inscreve (RN-LE-05: a pessoa atendida), como em `criarEntrada`. */
type CmdNovaEntrada = {
  servico: Servico;
  pessoa: Pessoa;
  respostas: Respostas;
  id: string;
  /** Entradas ativas para a regra de uma por serviço (INV-01). */
  entradasAtivas: Entrada[];
};

/**
 * RN-PUB-01/02, RN-ENC-04: inscrição numa sessão pública, sem agendador. Com vaga, confirmada
 * (na fila com o próximo número, se a sessão já abriu); em serviço com requisição sem foto
 * aceita, vaga segura (só antes da abertura); lotada, na reserva (não ocupa vaga).
 * Emergência, duplicada e regulado são recusados como em `criarEntrada`.
 */
export function inscreverPublica(
  sessao: SessaoVagas,
  dia: DiaSessao | null,
  cmd: CmdNovaEntrada & { responsavelId: string | null; fotoAceita: boolean },
  agora: number,
  config: ConfigUnidade = dia?.config ?? CONFIG_PADRAO,
): Resultado<{ entrada: Entrada; sessao: SessaoVagas; dia: DiaSessao | null }> {
  const { servico } = cmd;
  if (sessao.visibilidade !== "publica" || servico.id !== sessao.servicoId) return falha("transicao_proibida");
  const sit = situacao(dia, sessao);
  if (!sit.ok) return falha(sit.erro);
  if (jaNaSessao(dia, cmd.id)) return falha("duplicada");
  const criada = criarEntrada(
    cmd.entradasAtivas,
    { servico, pessoa: cmd.pessoa, responsavelId: cmd.responsavelId, respostas: cmd.respostas, id: cmd.id },
    agora,
    config,
  );
  if (!criada.ok) return falha(criada.erro);

  const fotoOk = servico.modo !== "requisicao" || cmd.fotoAceita;
  let condicao: string;
  if (!temVaga(sessao)) condicao = "Sessão lotada";
  else if (fotoOk) condicao = "sem requisição";
  else if (sit.aberta) return falha("requisicao_pendente");
  else condicao = "com requisição";
  const para = comAbertura(
    destino("—", ENTRADA_INSCRICAO, (t) => t.condicao.includes(condicao)),
    sit.aberta,
  );

  const entrada: Entrada = { ...criada.estado, estado: para, sessaoId: sessao.id };
  const eventos: Evento[] = criada.eventos.filter((e) => e.tipo !== "entrada_criada");
  eventos.push({
    tipo: para === "na_reserva" ? "na_reserva" : "inscrita",
    entradaId: entrada.id,
    sessaoId: sessao.id,
    dados: { estado: para },
  });
  let novoDia = dia;
  if (para === "na_fila" && dia !== null) {
    const r = porNaFila(dia, entrada, itemCriado(ITEM_INSCRICAO), agora);
    novoDia = r.dia;
    eventos.push(...r.eventos);
  }
  return ok({ entrada, sessao: para === "na_reserva" ? sessao : ocupar(sessao), dia: novoDia }, eventos);
}

/**
 * RN-PUB-02, AD-047: quem está na reserva troca por uma vaga em outra sessão pública do mesmo
 * serviço; a reserva é cancelada (a entrada é a mesma, com a data original). Sem foto aceita em
 * serviço com requisição, recebe vaga segura, só antes da abertura.
 */
export function trocarReserva(
  entrada: Entrada,
  destinoSessao: SessaoVagas,
  diaDestino: DiaSessao | null,
  cmd: { servico: Servico; fotoAceita: boolean },
  agora: number,
): Resultado<{ entrada: Entrada; sessao: SessaoVagas; dia: DiaSessao | null }> {
  const reservaId = entrada.sessaoId;
  if (entrada.estado !== "na_reserva" || reservaId === null || reservaId === destinoSessao.id) {
    return falha("transicao_proibida");
  }
  if (
    destinoSessao.visibilidade !== "publica" ||
    destinoSessao.servicoId !== entrada.servicoId ||
    cmd.servico.id !== entrada.servicoId
  ) {
    return falha("transicao_proibida");
  }
  const sit = situacao(diaDestino, destinoSessao);
  if (!sit.ok) return falha(sit.erro);
  if (jaNaSessao(diaDestino, entrada.id)) return falha("duplicada");
  if (!temVaga(destinoSessao)) return falha("sem_vaga");

  const fotoOk = cmd.servico.modo !== "requisicao" || cmd.fotoAceita;
  if (!fotoOk && sit.aberta) return falha("requisicao_pendente");
  const contrato = transicionar(TRANSICOES_ENTRADA, entrada.estado, fotoOk ? ENTRADA_TROCA : ENTRADA_TROCA_SEGURA);
  if (contrato !== "confirmada" && contrato !== "aguardando_encaminhamento") return falha("transicao_proibida");
  const para = comAbertura(contrato, sit.aberta);

  const nova: Entrada = { ...entrada, estado: para, sessaoId: destinoSessao.id };
  const eventos: Evento[] = [
    { tipo: "cancelada", entradaId: entrada.id, sessaoId: reservaId, motivo: "reserva trocada por vaga" },
    { tipo: "inscrita", entradaId: entrada.id, sessaoId: destinoSessao.id, dados: { estado: para } },
  ];
  let novoDia = diaDestino;
  if (para === "na_fila" && diaDestino !== null) {
    const r = porNaFila(diaDestino, nova, itemCriado(ITEM_INSCRICAO), agora);
    novoDia = r.dia;
    eventos.push(...r.eventos);
  }
  return ok({ entrada: nova, sessao: ocupar(destinoSessao), dia: novoDia }, eventos);
}

/**
 * RN-ENC-02/04: o agendador aceita a foto da requisição. Na lista, a entrada passa a aguardar;
 * com vaga segura, vira confirmada, só antes da abertura (`dia` = o da sessão da vaga, se houver).
 */
export function aceitarRequisicao(entrada: Entrada, dia: DiaSessao | null, agora: number): Resultado<Entrada> {
  if (entrada.estado !== "aguardando_encaminhamento") return falha("transicao_proibida");
  const segura = entrada.sessaoId !== null;
  if (segura && dia !== null) {
    if (dia.sessaoId !== entrada.sessaoId) return falha("transicao_proibida");
    if (dia.estado !== "planejada") return falha("fora_do_prazo");
  }
  const para = destino(entrada.estado, ENTRADA_ACEITA, (t) =>
    segura ? t.qualificador === "vaga segura" : t.qualificador === undefined,
  );
  const eventos: Evento[] = [{ tipo: "requisicao_aceita", entradaId: entrada.id, dados: { em: agora } }];
  if (para === "confirmada" && entrada.sessaoId !== null) {
    eventos.push({ tipo: "confirmada", entradaId: entrada.id, sessaoId: entrada.sessaoId });
  }
  return ok({ ...entrada, estado: para }, eventos);
}

/**
 * RN-FILA-03, RN-AL-06, RN-ENC-05: a recepção inclui no balcão, com a sessão aberta e vaga livre,
 * quem não está na fila; a pessoa (local, sem conta, salvo `responsavelId`) entra presente com o
 * próximo número. A recepção conferiu na hora, então a prioridade declarada já vem conferida.
 * Regulado, emergência e duplicada são recusados como em `criarEntrada`.
 */
export function incluirNoBalcao(
  dia: DiaSessao,
  cmd: CmdNovaEntrada & { sessao: SessaoVagas; responsavelId?: string | null },
  agora: number,
): Resultado<{ dia: DiaSessao; sessao: SessaoVagas; entrada: Entrada }> {
  const { servico, sessao } = cmd;
  if (sessao.id !== dia.sessaoId || servico.id !== sessao.servicoId || servico.id !== dia.servicoId) {
    return falha("transicao_proibida");
  }
  if (servico.modo === "regulado") return falha("servico_regulado");
  if (dia.estado !== "aberta") return falha("sessao_fechada");
  if (jaNaSessao(dia, cmd.id)) return falha("duplicada");
  const criada = criarEntrada(
    cmd.entradasAtivas,
    {
      servico,
      pessoa: cmd.pessoa,
      responsavelId: cmd.responsavelId ?? null,
      respostas: cmd.respostas,
      id: cmd.id,
    },
    agora,
    dia.config,
  );
  if (!criada.ok) return falha(criada.erro);
  if (!temVaga(sessao)) return falha("sem_vaga");
  const para = destinoPorCondicao("—", ENTRADA_BALCAO, () => true);
  if (para !== "na_fila") return falha("transicao_proibida");

  const base = criada.estado;
  const entrada: Entrada = {
    ...base,
    estado: para,
    sessaoId: sessao.id,
    prioridade: temPrioridade(base.prioridade)
      ? { ...base.prioridade, conferida: true, conferidaEm: agora }
      : base.prioridade,
  };
  const r = porNaFila(dia, entrada, itemCriado(ITEM_BALCAO), agora);
  const eventos: Evento[] = [
    ...criada.eventos.filter((e) => e.tipo !== "entrada_criada"),
    { tipo: "inscrita", entradaId: entrada.id, sessaoId: sessao.id, motivo: "balcão", dados: { estado: para } },
    ...r.eventos,
  ];
  return ok({ dia: r.dia, sessao: ocupar(sessao), entrada }, eventos);
}

/**
 * RN-ENC-06, AD-036/037/049: o agendador lança pelo CPF quem a regulação mandou, em sessão
 * privada com vaga. Entra confirmado, sem prazo de confirmação nem liberação na abertura; com a
 * sessão aberta, direto na fila remota. O risco da regulação (padrão rotina) vale como confirmado.
 * A conta só é ligada se verificada; senão, é pessoa sem app (sem push).
 */
export function lancarRegulado(
  sessao: SessaoVagas,
  dia: DiaSessao | null,
  cmd: {
    servico: Servico;
    id: string;
    pessoa: Pessoa;
    contaId: string | null;
    contaVerificada: boolean;
    riscoDaRegulacao?: NivelRisco;
    entradasAtivas: Entrada[];
  },
  agora: number,
  config: ConfigUnidade = dia?.config ?? CONFIG_PADRAO,
): Resultado<{ entrada: Entrada; sessao: SessaoVagas; dia: DiaSessao | null }> {
  const { servico } = cmd;
  if (servico.modo !== "regulado" || servico.id !== sessao.servicoId || sessao.visibilidade !== "privada") {
    return falha("transicao_proibida");
  }
  const sit = situacao(dia, sessao);
  if (!sit.ok) return falha(sit.erro);
  // A escala de risco (lista-espera, "Classificação de risco"): emergência não entra em lista nem fila;
  // vai ao SAMU (192), como no questionário (RN-LE-01, linha "Questionário = Emergência").
  if (cmd.riscoDaRegulacao === "emergencia") return falha("emergencia");
  if (jaNaSessao(dia, cmd.id)) return falha("duplicada");
  if (entradaAtivaDa(cmd.entradasAtivas, cmd.pessoa, servico.id)) return falha("duplicada");
  if (!temVaga(sessao)) return falha("sem_vaga");

  const para = destino("—", ENTRADA_LANCA, (t) =>
    t.condicao.includes(sit.aberta ? "sessão aberta" : "sessão privada planejada"),
  );
  const risco = cmd.riscoDaRegulacao ?? "rotina";
  const responsavelId = cmd.contaVerificada ? cmd.contaId : null;
  const entrada: Entrada = {
    id: cmd.id,
    servicoId: servico.id,
    responsavelId,
    pessoa: { ...cmd.pessoa },
    estado: para,
    dataEntradaOriginal: agora,
    classificacao: { nivel: risco, regra: "Classificação informada pela regulação", apoio: false },
    riscoConfirmado: risco,
    prioridade: {
      grupos: prioridadeDaPessoa(cmd.pessoa, [], agora, config.fuso),
      conferida: false,
      conferidaEm: null,
    },
    remanejada: null,
    recusas: 0,
    sessaoId: sessao.id,
    alocadaEm: null,
    perguntadoEm: null,
    respondidoEm: null,
    arquivadaEm: null,
    sessoesRecusadas: [],
  };
  const eventos: Evento[] = [
    { tipo: "lancada", entradaId: entrada.id, sessaoId: sessao.id, dados: { push: responsavelId !== null } },
  ];
  let novoDia = dia;
  if (para === "na_fila" && dia !== null) {
    const r = porNaFila(dia, entrada, itemCriado(ITEM_LANCA), agora);
    novoDia = r.dia;
    eventos.push(...r.eventos);
  }
  return ok({ entrada, sessao: ocupar(sessao), dia: novoDia }, eventos);
}

/**
 * RN-ENC-06, AD-037: o agendador remove, com motivo, um lançamento nunca chamado no dia. A vaga é
 * liberada sem sugestão (não há lista); push só para conta verificada (ligada).
 */
export function removerLancamento(
  entrada: Entrada,
  sessao: SessaoVagas,
  dia: DiaSessao | null,
  cmd: { servico: Servico; motivo: string },
  agora: number,
): Resultado<{ entrada: Entrada; sessao: SessaoVagas; dia: DiaSessao | null }> {
  const { servico } = cmd;
  if (servico.modo !== "regulado" || entrada.servicoId !== servico.id || entrada.sessaoId !== sessao.id) {
    return falha("transicao_proibida");
  }
  const para = transicionar(TRANSICOES_ENTRADA, entrada.estado, ENTRADA_REMOVE);
  if (para !== "cancelada") return falha("transicao_proibida");

  let novoDia = dia;
  if (entrada.estado === "na_fila") {
    if (dia === null || dia.sessaoId !== sessao.id) return falha("transicao_proibida");
    const item = dia.itens.find((i) => i.entradaId === entrada.id);
    if (!item || dia.chamadas.some((c) => c.itemId === item.id)) return falha("transicao_proibida");
    if (transicionar(TRANSICOES_ITEM, item.estado, ITEM_REMOVE) !== "saiu_da_fila") return falha("transicao_proibida");
    novoDia = {
      ...dia,
      itens: dia.itens.map((i) =>
        i.id === item.id
          ? { ...i, estado: "saiu_da_fila" as const, travadoAtras: [] }
          : { ...i, travadoAtras: i.travadoAtras.filter((t) => t !== item.id) },
      ),
    };
  }
  const ids = { entradaId: entrada.id, sessaoId: sessao.id };
  return ok({ entrada: { ...entrada, estado: para }, sessao: desocupar(sessao), dia: novoDia }, [
    { tipo: "removida", ...ids, motivo: cmd.motivo, dados: { push: entrada.responsavelId !== null } },
    { tipo: "vaga_liberada", ...ids, motivo: "lançamento removido; sem sugestão", dados: { em: agora } },
  ]);
}
