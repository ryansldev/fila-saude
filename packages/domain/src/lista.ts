import { type EstadoEntrada, TRANSICOES_ENTRADA, type Transicao, transicaoUnica, transicionar } from "./contratos.ts";
import { CONFIG_PADRAO, type DiaSessao } from "./fila.ts";
import { type ChaveSugestao, compararSugestao, type Risco } from "./ordem.ts";
import { aConferir, type Grupo, grupoDeDeclarado, type PrioridadeLegal, prioridadeDaPessoa } from "./prioridade.ts";
import { classificar } from "./questionario.ts";
import { type Evento, falha, ok, type Resultado } from "./resultado.ts";
import { idadeEm, mesmoDia } from "./tempo.ts";
import type { Classificacao, ConfigUnidade, NivelRisco, Respostas } from "./tipos.ts";

/** Pessoa atendida (AD-018): pode não ser o dono da conta (responsável). */
export type Pessoa = { nome: string; nascimento: string; cpf: string | null };

export type Entrada = {
  id: string;
  servicoId: string;
  /** Conta que recebe os pushes; `null` para pessoa local criada pela recepção (RN-LE-04). */
  responsavelId: string | null;
  pessoa: Pessoa;
  estado: EstadoEntrada;
  /** Nunca muda (INV-09). */
  dataEntradaOriginal: number;
  /** Nível sugerido pelo questionário (RN-RISCO-01). */
  classificacao: Classificacao;
  /** Gravado só por agendador ou triagem (INV-07). */
  riscoConfirmado: NivelRisco | null;
  /**
   * Prioridade guardada: só os grupos declarados (ou dados pela recepção) e a conferência deles,
   * que vale nas próximas idas até o prazo (AD-024). Idoso e idoso80 não ficam aqui: vêm da data
   * de nascimento em cada uso (`prioridadeDaEntrada`, AD-027).
   */
  prioridade: PrioridadeLegal;
  /** Origem da remanejada (RN-REM-03); `null` = não remanejada. */
  remanejada: null | Origem;
  recusas: number;
  sessaoId: string | null;
  alocadaEm: number | null;
  /** Última pergunta "ainda precisa?" (RN-PARADA-01). */
  perguntadoEm: number | null;
  /** Última resposta "ainda preciso" (ou reativação); a pergunta está pendente se é anterior a `perguntadoEm`. */
  respondidoEm: number | null;
  /** Quando foi arquivada (RN-PARADA-02); conta o prazo de reativação. */
  arquivadaEm: number | null;
  /** Sessões cuja alocação recusou: não volta a ser sugerida para elas (RN-CONF-04 "sugere o próximo"). */
  sessoesRecusadas: string[];
};

/** Origem do remanejado (RN-REM-03): decide o que a 2ª "Outra data" faz. */
export type Origem = "privada" | "publica" | "regulada";

export type Servico = { id: string; modo: "livre" | "requisicao" | "regulado"; exigeTriagem: boolean };

export type SessaoVagas = {
  id: string;
  servicoId: string;
  visibilidade: "publica" | "privada";
  /** `null` = sem limite de vagas. */
  vagas: number | null;
  inicio: number;
  ocupadas: number;
};

/**
 * Formato único de toda saída que libera vaga (recusa, "Outra data", "Desistir", cancelamento do
 * paciente, remoção de lançamento): a entrada nova, a sessão **já com a vaga liberada** e o dia
 * sem o item (ou como veio). Regra para quem chama: depois de qualquer saída, chame
 * `preencherDaReserva` com a sessão devolvida (RN-PUB-02, RN-CANC-02); nunca libere de novo.
 * `sessao` só é `null` em saída de quem não tinha vaga (ex.: desistir sem data).
 */
export type Saida<S extends SessaoVagas | null = SessaoVagas> = { entrada: Entrada; sessao: S; dia: DiaSessao | null };

export type Sugestao = { entradaId: string; motivos: string[] };

export type ItemLigacao = { entradaId: string; sessaoId: string; prazo: number; destacada: boolean };

const H = 3_600_000;
const DIA = 24 * H;
/** Prazo para reativar uma entrada arquivada (RN-PARADA-02, proposta). */
const REATIVAR_DIAS = 30;

const INATIVAS: EstadoEntrada[] = ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"];

const EVENTO_CRIA = "Paciente ou recepção cria";
const EVENTO_EMERGENCIA = "Questionário = Emergência";
const EVENTO_ALOCA = "Agendador aloca";
const EVENTO_CONFIRMA = "Paciente ou agendador confirma";
const EVENTO_RECUSA = "Recusa";
const EVENTO_OUTRA_DATA = '"Outra data"';
const EVENTO_ABRE_SEM_CONFIRMACAO = "Sessão abre sem confirmação";
const EVENTO_PERGUNTA = "A cada 30 dias na lista";
const EVENTO_ARQUIVA = "7 dias sem resposta";
const EVENTO_REATIVA = "Paciente reativa";

/**
 * Destino da única linha do contrato que casa com (de, evento) e com o filtro da condição;
 * usado quando a transição depende da condição (vários destinos para o mesmo evento).
 * Escolhe a linha com `transicaoUnica` (o mesmo seletor da fase 2); lança sem linha ou com mais de uma.
 */
export function destinoPorCondicao(
  de: EstadoEntrada | "—",
  evento: string,
  filtro: (t: Transicao<EstadoEntrada>) => boolean,
): EstadoEntrada | "(mesmo)" | null {
  const linha = transicaoUnica(TRANSICOES_ENTRADA, de, evento, filtro);
  if (!linha) throw new Error(`contrato: sem linha única para "${de}" com "${evento}"`);
  return linha.para === "(não cria)" ? null : linha.para;
}

const normalizarNome = (nome: string): string =>
  nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

const digitos = (cpf: string): string => cpf.replace(/\D/g, "");

/** RN-LE-02: a mesma pessoa atendida, pelo CPF quando os dois têm; senão, por nome + nascimento. */
function mesmaPessoa(a: Pessoa, b: Pessoa): boolean {
  if (a.cpf && b.cpf) return digitos(a.cpf) === digitos(b.cpf);
  return a.nascimento === b.nascimento && normalizarNome(a.nome) === normalizarNome(b.nome);
}

/** Entrada ativa da pessoa atendida no serviço (INV-01), para mostrar a existente ao recusar a duplicada. */
export function entradaAtivaDa(entradas: Entrada[], pessoa: Pessoa, servicoId: string): Entrada | undefined {
  return entradas.find(
    (e) => e.servicoId === servicoId && !INATIVAS.includes(e.estado) && mesmaPessoa(e.pessoa, pessoa),
  );
}

/**
 * RN-LE-01/02/03/05: cria a entrada da pessoa atendida com o nível sugerido e a prioridade
 * declarada (a idade entra em cada uso, AD-027). Regulado e emergência não criam; duplicada é recusada.
 */
export function criarEntrada(
  entradasAtivas: Entrada[],
  cmd: { servico: Servico; pessoa: Pessoa; responsavelId: string | null; respostas: Respostas; id: string },
  agora: number,
  config: ConfigUnidade = CONFIG_PADRAO,
): Resultado<Entrada> {
  const { servico, pessoa, respostas } = cmd;
  if (servico.modo === "regulado") return falha("servico_regulado");
  const classificacao = classificar(respostas, idadeEm(pessoa.nascimento, agora, config.fuso));
  if (classificacao.nivel === "emergencia") {
    if (destinoPorCondicao("—", EVENTO_EMERGENCIA, () => true) !== null) throw new Error("contrato: emergência cria");
    return falha("emergencia");
  }
  if (entradaAtivaDa(entradasAtivas, pessoa, servico.id)) return falha("duplicada");

  const comRequisicao = servico.modo === "requisicao";
  const estado = destinoPorCondicao("—", EVENTO_CRIA, (t) =>
    t.condicao.includes(comRequisicao ? "com requisição" : "sem requisição"),
  );
  if (estado === null || estado === "(mesmo)") throw new Error("contrato: criação sem estado");

  const declarados: Grupo[] = [...new Set(respostas.grupos.map(grupoDeDeclarado))];
  const entrada: Entrada = {
    id: cmd.id,
    servicoId: servico.id,
    responsavelId: cmd.responsavelId,
    pessoa: { ...pessoa },
    estado,
    dataEntradaOriginal: agora,
    classificacao,
    riscoConfirmado: null,
    prioridade: { grupos: declarados, conferida: false, conferidaEm: null },
    remanejada: null,
    recusas: 0,
    sessaoId: null,
    alocadaEm: null,
    perguntadoEm: null,
    respondidoEm: null,
    arquivadaEm: null,
    sessoesRecusadas: [],
  };
  const eventos: Evento[] = [{ tipo: "entrada_criada", entradaId: entrada.id, dados: { estado } }];
  if (classificacao.nivel === "urgente") {
    eventos.push({ tipo: "alerta_agendador", entradaId: entrada.id, motivo: classificacao.regra });
  }
  return ok(entrada, eventos);
}

/**
 * Prioridade legal da entrada em `agora` (AD-027, RN-RISCO-04): idoso/idoso80 pela idade de agora
 * no fuso da unidade, mais os grupos guardados, com a conferência guardada (AD-024).
 */
export function prioridadeDaEntrada(e: Entrada, agora: number, fuso: string): PrioridadeLegal {
  return { ...e.prioridade, grupos: prioridadeDaPessoa(e.pessoa, e.prioridade.grupos, agora, fuso) };
}

/**
 * Guarda na entrada a conferência que a recepção fez no item (RN-FILA-05, AD-024): grupos
 * conferidos, retirados ou dados, e a hora. Chame depois de `conferirEMarcar` ou `darPrioridade`.
 */
export function conferenciaNaEntrada(e: Entrada, item: { entradaId: string; prioridade: PrioridadeLegal }): Entrada {
  if (item.entradaId !== e.id) throw new Error(`item da entrada ${item.entradaId}, não de ${e.id}`);
  const p = item.prioridade;
  return { ...e, prioridade: { grupos: aConferir(p), conferida: p.conferida, conferidaEm: p.conferidaEm } };
}

/** Risco vigente: confirmado, se houver; senão, sugerido. Emergência não fica na lista. */
export function riscoVigente(e: Entrada): Risco {
  const nivel = e.riscoConfirmado ?? e.classificacao.nivel;
  return nivel === "emergencia" ? "urgente" : nivel;
}

const chaveSugestao = (e: Entrada, agora: number, fuso: string): ChaveSugestao => ({
  urgenciaConfirmada: e.riscoConfirmado === "urgente",
  remanejada: e.remanejada !== null,
  risco: riscoVigente(e),
  prioridade: prioridadeDaEntrada(e, agora, fuso),
  dataEntradaOriginal: e.dataEntradaOriginal,
  id: e.id,
});

const ROTULO_RISCO: Record<Risco, string> = { urgente: "urgente", atencao: "atenção", rotina: "rotina" };

const ROTULO_GRUPO: Record<Exclude<Grupo, "idoso" | "idoso80">, string> = {
  gestante: "gestante",
  lactante: "lactante",
  colo: "criança de colo",
  pcd: "pessoa com deficiência",
  tea: "TEA",
  mobilidade: "mobilidade reduzida",
  doador: "doador de sangue",
  obesidade: "obesidade",
};

function motivos(e: Entrada, agora: number, fuso: string): string[] {
  const m = [`${ROTULO_RISCO[riscoVigente(e)]} ${e.riscoConfirmado ? "confirmado" : "sugerido"}`];
  if (e.remanejada !== null) m.push("remanejada");
  for (const g of prioridadeDaEntrada(e, agora, fuso).grupos) {
    m.push(
      g === "idoso" || g === "idoso80"
        ? `pessoa idosa, ${idadeEm(e.pessoa.nascimento, agora, fuso)} anos`
        : ROTULO_GRUPO[g],
    );
  }
  m.push(`espera há ${Math.floor((agora - e.dataEntradaOriginal) / DIA)} dias`);
  return m;
}

/**
 * RN-AL-01/02: entradas do serviço que podem ocupar as vagas (aguardando ou remanejadas, sem ter
 * recusado esta sessão), na ordem da sugestão, com os motivos. Nada é alocado aqui (INV-08).
 */
export function sugerir(entradas: Entrada[], sessao: SessaoVagas, config: ConfigUnidade, agora: number): Sugestao[] {
  return entradas
    .filter(
      (e) =>
        e.servicoId === sessao.servicoId &&
        transicionar(TRANSICOES_ENTRADA, e.estado, EVENTO_ALOCA) === "alocada" &&
        !e.sessoesRecusadas.includes(sessao.id),
    )
    .sort((a, b) =>
      compararSugestao(
        chaveSugestao(a, agora, config.fuso),
        chaveSugestao(b, agora, config.fuso),
        config.ordemMunicipio,
      ),
    )
    .map((e) => ({ entradaId: e.id, motivos: motivos(e, agora, config.fuso) }));
}

/** RN-CONF-01: 24 h da alocação, sem passar do início da sessão. */
export function prazoConfirmacao(entrada: Entrada, sessao: SessaoVagas, config: ConfigUnidade): number {
  if (entrada.alocadaEm === null) throw new Error(`entrada ${entrada.id} não está alocada`);
  return Math.min(entrada.alocadaEm + config.prazoConfirmacaoHoras * H, sessao.inicio);
}

/**
 * Agendador aloca (RN-AL-04/05/06, RN-RISCO-01): só em sessão privada do serviço, até a véspera
 * no fuso da unidade, com vaga livre. O nível vira confirmado (o do agendador, se ele alterou).
 */
export function alocar(
  entrada: Entrada,
  sessao: SessaoVagas,
  // RN-RISCO-01 (2026-11-13): o agendador não confirma risco; só o enfermeiro (triagem).
  _cmd: Record<string, never>,
  agora: number,
  config: ConfigUnidade = CONFIG_PADRAO,
): Resultado<{ entrada: Entrada; sessao: SessaoVagas }> {
  if (entrada.servicoId !== sessao.servicoId || sessao.visibilidade !== "privada") return falha("transicao_proibida");
  if (transicionar(TRANSICOES_ENTRADA, entrada.estado, EVENTO_ALOCA) !== "alocada") return falha("transicao_proibida");
  // Emergência não entra em lista nem fila (RN-LE-01), como em `lancarRegulado`.
  if (agora >= sessao.inicio || mesmoDia(agora, sessao.inicio, config.fuso)) return falha("fora_do_prazo");
  if (sessao.vagas !== null && sessao.ocupadas >= sessao.vagas) return falha("sem_vaga");

  const nova: Entrada = {
    ...entrada,
    estado: "alocada",
    sessaoId: sessao.id,
    alocadaEm: agora,
    riscoConfirmado: entrada.riscoConfirmado,
  };
  const prazo = prazoConfirmacao(nova, sessao, config);
  return ok({ entrada: nova, sessao: { ...sessao, ocupadas: sessao.ocupadas + 1 } }, [
    { tipo: "alocada", entradaId: entrada.id, sessaoId: sessao.id, dados: { prazo } },
  ]);
}

const alocadaNesta = (entrada: Entrada, sessao: SessaoVagas): boolean =>
  entrada.estado === "alocada" && entrada.sessaoId === sessao.id;

/** RN-CONF-01/02: paciente ou agendador confirma; depois das 24 h ainda vale, até a abertura. */
export function confirmar(entrada: Entrada, sessao: SessaoVagas, agora: number): Resultado<Entrada> {
  if (!alocadaNesta(entrada, sessao)) return falha("transicao_proibida");
  if (transicionar(TRANSICOES_ENTRADA, entrada.estado, EVENTO_CONFIRMA) !== "confirmada") {
    return falha("transicao_proibida");
  }
  if (agora >= sessao.inicio) return falha("fora_do_prazo");
  return ok({ ...entrada, estado: "confirmada" }, [{ tipo: "confirmada", entradaId: entrada.id, sessaoId: sessao.id }]);
}

/** Qualificador da linha de 2ª "Outra data" (RN-REM-03), pela origem da remanejada. */
const QUALIFICADOR_2A_RECUSA: Record<Origem, string> = {
  privada: "remanejada de sessão privada",
  publica: "remanejada de sessão pública, alocada numa privada",
  regulada: "remanejada, serviço regulado",
};

/**
 * Fonte única do "Outra data" (RN-REM-03): destino da remanejada no estado `de`, pela vez
 * (`recusas` = 0 → 1ª) e pela origem. `null` quando o contrato não tem a linha para esse estado
 * (transição proibida); lança se o texto do contrato mudou e a linha ficou ambígua ou sumiu.
 */
export function destinoOutraData(de: EstadoEntrada, recusas: number, origem: Origem): EstadoEntrada | null {
  const condicao = recusas === 0 ? "1ª recusa" : "2ª recusa";
  const linhas = TRANSICOES_ENTRADA.filter(
    (t) => t.de === de && t.evento === EVENTO_OUTRA_DATA && t.condicao === condicao,
  );
  if (linhas.length === 0) return null;
  const casam = recusas === 0 ? linhas : linhas.filter((t) => t.qualificador === QUALIFICADOR_2A_RECUSA[origem]);
  const [linha] = casam;
  if (!linha || casam.length > 1 || linha.para === "(mesmo)" || linha.para === "(não cria)") {
    throw new Error(`contrato: sem linha única de "Outra data" (${condicao}) para "${de}", origem ${origem}`);
  }
  return linha.para;
}

/** Aviso da remanejada encerrada por "Outra data" ou "Desistir", pela origem (RN-REM-03). */
const MOTIVO_CANCELADA: Record<Origem, string | undefined> = {
  privada: undefined,
  publica: "inscreva-se de novo",
  regulada: "comunicar a regulação",
};

/**
 * Núcleo do "Outra data" (RN-REM-03) na sessão da entrada: só em sessão privada (a regulada é
 * privada); a vaga é liberada e a sessão não volta a ser sugerida. Usado por `recusar` (remanejada
 * alocada) e por `outraData` (encerramento.ts), que acrescenta a saída da fila do dia.
 */
export function outraDataNaSessao(
  entrada: Entrada,
  sessao: SessaoVagas,
  agora: number,
): Resultado<{ entrada: Entrada; sessao: SessaoVagas }> {
  const origem = entrada.remanejada;
  if (origem === null || entrada.sessaoId !== sessao.id || sessao.visibilidade !== "privada") {
    return falha("transicao_proibida");
  }
  const para = destinoOutraData(entrada.estado, entrada.recusas, origem);
  if (para === null) return falha("transicao_proibida");
  const nova: Entrada = {
    ...entrada,
    estado: para,
    sessaoId: null,
    alocadaEm: null,
    recusas: entrada.recusas + 1,
    remanejada: para === "remanejada" ? origem : null,
    sessoesRecusadas: [...entrada.sessoesRecusadas, sessao.id],
  };
  const ids = { entradaId: entrada.id, sessaoId: sessao.id };
  const eventos: Evento[] = [
    { tipo: "recusada", ...ids, dados: { para, em: agora } },
    { tipo: "vaga_liberada", ...ids },
  ];
  const motivo = MOTIVO_CANCELADA[origem];
  if (para === "cancelada") eventos.push({ tipo: "cancelada", ...ids, ...(motivo === undefined ? {} : { motivo }) });
  return ok({ entrada: nova, sessao: { ...sessao, ocupadas: Math.max(0, sessao.ocupadas - 1) } }, eventos);
}

/**
 * RN-CONF-04: a recusa libera a vaga na hora (formato `Saida`, sem dia: alocada não tem item) e
 * a entrada não volta a ser sugerida para esta sessão; não remanejada volta à lista com a data original. Remanejada alocada: é o "Outra data"
 * (RN-REM-03) e delega a `outraDataNaSessao`. O app chama `outraData` (encerramento.ts) para
 * qualquer remanejada com data, inclusive alocada; `recusar` dá o mesmo resultado para ela.
 */
export function recusar(entrada: Entrada, sessao: SessaoVagas, agora: number): Resultado<Saida> {
  if (!alocadaNesta(entrada, sessao)) return falha("transicao_proibida");
  if (entrada.remanejada !== null) {
    const r = outraDataNaSessao(entrada, sessao, agora);
    return r.ok ? ok({ ...r.estado, dia: null }, r.eventos) : r;
  }
  const para = transicionar(TRANSICOES_ENTRADA, entrada.estado, EVENTO_RECUSA);
  if (para !== "aguardando") return falha("transicao_proibida");

  const nova: Entrada = {
    ...entrada,
    estado: para,
    sessaoId: null,
    alocadaEm: null,
    sessoesRecusadas: [...entrada.sessoesRecusadas, sessao.id],
  };
  const ids = { entradaId: entrada.id, sessaoId: sessao.id };
  return ok({ entrada: nova, sessao: { ...sessao, ocupadas: Math.max(0, sessao.ocupadas - 1) }, dia: null }, [
    { tipo: "recusada", ...ids, dados: { para, em: agora } },
    { tipo: "vaga_liberada", ...ids },
  ]);
}

/**
 * RN-CONF-03: alocações pendentes, pela sessão mais próxima; destacada a partir do prazo de
 * confirmação (24 h, ou o início da sessão, se vier antes).
 */
export function listaDeLigacao(
  entradas: Entrada[],
  sessoes: SessaoVagas[],
  config: ConfigUnidade,
  agora: number,
): ItemLigacao[] {
  const itens: (ItemLigacao & { inicio: number })[] = [];
  for (const e of entradas) {
    const sessao = sessoes.find((s) => s.id === e.sessaoId);
    if (!sessao || !alocadaNesta(e, sessao)) continue;
    const prazo = prazoConfirmacao(e, sessao, config);
    itens.push({ entradaId: e.id, sessaoId: sessao.id, prazo, destacada: agora >= prazo, inicio: sessao.inicio });
  }
  return itens
    .sort((a, b) => a.inicio - b.inicio || a.prazo - b.prazo || (a.entradaId < b.entradaId ? -1 : 1))
    .map(({ inicio: _, ...item }) => item);
}

/** RN-CONF-04: na abertura, alocações ainda pendentes desta sessão voltam à lista com a data original. */
export function pendentesNaAbertura(
  entradas: Entrada[],
  sessao: SessaoVagas,
): Resultado<{ entradas: Entrada[]; sessao: SessaoVagas }> {
  const eventos: Evento[] = [];
  const novas = entradas.map((e) => {
    if (!alocadaNesta(e, sessao)) return e;
    const para = transicionar(TRANSICOES_ENTRADA, e.estado, EVENTO_ABRE_SEM_CONFIRMACAO);
    if (para !== "aguardando") throw new Error(`contrato: alocada não volta à lista na abertura (${para})`);
    eventos.push({
      tipo: "vaga_liberada",
      entradaId: e.id,
      sessaoId: sessao.id,
      motivo: "sessão abriu sem confirmação",
    });
    return { ...e, estado: para, sessaoId: null, alocadaEm: null };
  });
  return ok(
    { entradas: novas, sessao: { ...sessao, ocupadas: Math.max(0, sessao.ocupadas - eventos.length) } },
    eventos,
  );
}

const perguntaPendente = (e: Entrada): boolean =>
  e.perguntadoEm !== null && (e.respondidoEm === null || e.respondidoEm < e.perguntadoEm);

/**
 * RN-PARADA-01: a cada 30 dias na lista (desde a entrada, a última pergunta ou a última resposta),
 * pergunta "ainda precisa?". Com a pergunta pendente, não pergunta de novo.
 */
export function perguntarAindaPrecisa(entrada: Entrada, config: ConfigUnidade, agora: number): Resultado<Entrada> {
  if (transicionar(TRANSICOES_ENTRADA, entrada.estado, EVENTO_PERGUNTA) !== "(mesmo)") {
    return falha("transicao_proibida");
  }
  const desde = Math.max(entrada.dataEntradaOriginal, entrada.perguntadoEm ?? 0, entrada.respondidoEm ?? 0);
  if (perguntaPendente(entrada) || agora - desde < config.aindaPrecisa.intervaloDias * DIA) {
    return falha("fora_do_prazo");
  }
  return ok({ ...entrada, perguntadoEm: agora }, [{ tipo: "ainda_precisa", entradaId: entrada.id }]);
}

/** Resposta "ainda preciso": a entrada segue na lista e a próxima pergunta conta daqui. */
export function responderAindaPrecisa(entrada: Entrada, agora: number): Resultado<Entrada> {
  if (entrada.estado !== "aguardando" || !perguntaPendente(entrada)) return falha("transicao_proibida");
  return ok({ ...entrada, respondidoEm: agora });
}

/** RN-PARADA-02: 7 dias sem resposta arquiva (não apaga) e avisa o paciente. */
export function arquivar(entrada: Entrada, config: ConfigUnidade, agora: number): Resultado<Entrada> {
  if (transicionar(TRANSICOES_ENTRADA, entrada.estado, EVENTO_ARQUIVA) !== "arquivada") {
    return falha("transicao_proibida");
  }
  const perguntadoEm = entrada.perguntadoEm;
  if (
    perguntadoEm === null ||
    !perguntaPendente(entrada) ||
    agora - perguntadoEm < config.aindaPrecisa.prazoDias * DIA
  ) {
    return falha("fora_do_prazo");
  }
  return ok({ ...entrada, estado: "arquivada", arquivadaEm: agora }, [{ tipo: "arquivada", entradaId: entrada.id }]);
}

/**
 * RN-PARADA-02 (proposta): reativa em até 30 dias do arquivamento, com a data original, exceto se
 * o serviço virou regulado. A reativação vale como resposta "ainda preciso". Recusa se a pessoa
 * já tem outra entrada ativa no serviço (INV-01).
 */
export function reativar(
  entradasAtivas: Entrada[],
  entrada: Entrada,
  servico: Servico,
  agora: number,
): Resultado<Entrada> {
  if (transicionar(TRANSICOES_ENTRADA, entrada.estado, EVENTO_REATIVA) !== "aguardando") {
    return falha("transicao_proibida");
  }
  if (servico.modo === "regulado") return falha("servico_regulado");
  if (entrada.arquivadaEm === null || agora - entrada.arquivadaEm > REATIVAR_DIAS * DIA) return falha("fora_do_prazo");
  const outras = entradasAtivas.filter((e) => e.id !== entrada.id);
  if (entradaAtivaDa(outras, entrada.pessoa, entrada.servicoId)) return falha("duplicada");
  return ok({ ...entrada, estado: "aguardando", arquivadaEm: null, respondidoEm: agora }, [
    { tipo: "reativada", entradaId: entrada.id },
  ]);
}
