import z from "zod";
import { nascimentoSchema } from "./auth";
import { cpfSchema } from "./cpf";
import { sessaoSchema } from "./sessao";

// Fatia 1 da v0.1: fila do dia (painel), operação da estação e as telas do app.

export const etapaSchema = z.enum(["triagem", "atendimento"]);
export const estadoItemSchema = z.enum([
  "remoto",
  "presente",
  "chamado",
  "atendido_na_etapa",
  "saiu_da_fila",
  "remanejado",
]);

/** Item da fila como o painel vê: nome para a equipe; nada clínico além do nível de risco usado na ordem. */
export const itemDaFilaSchema = z.object({
  id: z.string(),
  entradaId: z.uuid(),
  senha: z.string(),
  nome: z.string(),
  etapa: etapaSchema,
  estado: estadoItemSchema,
  pulos: z.number().int().min(0),
  risco: z.enum(["emergencia", "muito_urgente", "urgente", "atencao", "rotina"]),
  prioridade: z.boolean(),
  estacaoId: z.string().nullable(),
  /** RN-FILA-05: o que a recepção precisa conferir antes da presença. */
  pendencias: z.array(z.string()),
  /** RN-PRES-03: para comparar com o documento; CPF mascarado (LGPD), só os dígitos do meio. */
  documento: z.object({ nascimento: z.string(), cpf: z.string().nullable() }),
});

export const filaDaSessaoSchema = z.object({
  sessao: sessaoSchema,
  itens: z.array(itemDaFilaSchema),
  reserva: z.number().int().min(0),
});
export type ItemDaFila = z.infer<typeof itemDaFilaSchema>;
export type FilaDaSessao = z.infer<typeof filaDaSessaoSchema>;

export const nivelRiscoSchema = z.enum(["emergencia", "muito_urgente", "urgente", "atencao", "rotina"]);
export type NivelRiscoApi = z.infer<typeof nivelRiscoSchema>;

/**
 * Só na estação de triagem (RN-RISCO-01, RN-RISCO-06): o que o app sugeriu, a regra que gerou o
 * sugerido, os grupos de prioridade declarados e `apoio` (resposta sobre autolesão: CVV e SAMU).
 */
export const fichaDaTriagemSchema = z.object({
  riscoSugerido: nivelRiscoSchema,
  regra: z.string(),
  apoio: z.boolean(),
  prioridade: z.array(z.string()),
});

export const chamadoSchema = z.object({
  itemId: z.string(),
  senha: z.string(),
  nome: z.string(),
  etapa: etapaSchema,
  pulos: z.number().int().min(0),
  chamadoEm: z.iso.datetime(),
  toleranciaEsgotada: z.boolean(),
  /** Hora do "Compareceu" (a pessoa entrou na sala); `null` enquanto esperam ela entrar. */
  compareceuEm: z.iso.datetime().nullable(),
  /** Grupos de prioridade declarados (ex.: "idoso"), em qualquer etapa. */
  prioridade: z.array(z.string()),
  triagem: fichaDaTriagemSchema.optional(),
});

/**
 * Corpo de "chamar" e "finalizar": na triagem, a cor dada a quem sai (H3: obrigatória com alguém
 * chamado) e, só com vermelho, `encaminhar` à emergência, que tira da fila desta unidade (AD-059).
 */
export const corpoComandoSchema = z
  .object({ riscoConfirmado: nivelRiscoSchema.optional(), encaminhar: z.boolean().optional() })
  .default({});

/** Tela da estação (T3.7): a sessão aberta de hoje que ela atende, o chamado e quantos aguardam presentes. */
export const operacaoEstacaoSchema = z.object({
  estacao: z.object({ id: z.uuid(), nome: z.string(), etapa: etapaSchema }),
  sessao: z.object({ id: z.uuid(), servico: z.string(), estado: z.string() }).nullable(),
  chamado: chamadoSchema.nullable(),
  aguardando: z.number().int().min(0),
  remotos: z.number().int().min(0),
  toleranciaMin: z.number().int().min(0),
  aviso: z.enum(["ninguem_aguardando"]).nullable(),
  /** Até 3 presentes, na ordem em que esta estação vai chamar; só o primeiro nome. */
  proximos: z.array(z.object({ senha: z.string(), nome: z.string(), presenteDesde: z.iso.datetime() })),
  /** Até 3 a caminho (remotos da etapa), na ordem da fila; só o primeiro nome. */
  aCaminho: z.array(z.object({ senha: z.string(), nome: z.string() })),
  /** Quem espera há mais tempo na unidade e o tempo-alvo dele (min); `null` sem ninguém. */
  maisAntigo: z.object({ presenteDesde: z.iso.datetime(), tempoAlvoMin: z.number().int().min(0) }).nullable(),
  /** Hora do servidor: o cronômetro conta por ela (o relógio do computador pode estar errado). */
  agora: z.iso.datetime(),
});
export type OperacaoEstacao = z.infer<typeof operacaoEstacaoSchema>;

export const comandoEstacaoSchema = z.enum([
  "chamar",
  "rechamar",
  "finalizar",
  "nao-compareceu",
  "compareceu",
  "desfazer-compareceu",
]);
export type ComandoEstacao = z.infer<typeof comandoEstacaoSchema>;

// ---- App do paciente ----

/** Tela 5 (unidades próximas): onde fica cada unidade e quantos atendimentos abertos ela tem. */
export const unidadePublicaSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  tipo: z.string(),
  endereco: z.object({ logradouro: z.string(), numero: z.string(), bairro: z.string(), cep: z.string() }),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  /** Atendimentos públicos com inscrição aberta (os mesmos da agenda). */
  atendimentos: z.number().int().min(0),
});
export type UnidadePublica = z.infer<typeof unidadePublicaSchema>;

export const municipioPublicoSchema = z.object({ slug: z.string(), nome: z.string(), uf: z.string().nullable() });

/** Agenda pública (T3.2): só dados da sessão, nunca de paciente. */
export const sessaoDaAgendaSchema = z.object({
  id: z.uuid(),
  unidade: z.object({ id: z.uuid(), nome: z.string(), bairro: z.string() }),
  servico: z.object({ id: z.uuid(), nome: z.string() }),
  inicio: z.iso.datetime(),
  fim: z.iso.datetime(),
  profissional: z.string().nullable(),
  vagasRestantes: z.number().int().min(0).nullable(),
  estado: z.enum(["planejada", "aberta"]),
});
export type SessaoDaAgenda = z.infer<typeof sessaoDaAgendaSchema>;

export const respostasSchema = z.object({
  alarmes: z.array(
    z.enum(["falta_de_ar", "dor_no_peito", "desmaio", "fraqueza_de_um_lado", "sangramento", "convulsao", "autolesao"]),
  ),
  motivo: z.enum(["novo", "acompanhamento", "exame", "receita"]),
  gravidade: z.enum(["leve", "moderado", "forte"]).nullable(),
  condicoes: z.array(z.enum(["diabetes", "pressao_alta", "coracao", "respiratoria", "cancer", "imunidade_baixa"])),
  grupos: z.array(
    z.enum([
      "gestante",
      "lactante",
      "crianca_de_colo",
      "pcd",
      "tea",
      "mobilidade_reduzida",
      "doador_de_sangue",
      "obesidade",
    ]),
  ),
});

/** "Para quem é?" (AD-018): eu (dados da conta) ou outra pessoa. */
export const inscricaoEntradaSchema = z.object({
  paraQuem: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("eu") }),
    z.object({
      tipo: z.literal("outra"),
      nome: z.string().trim().min(3).max(200),
      nascimento: nascimentoSchema,
      // Opcional, mas quando vem é um CPF válido: senão a inscrição cai em outra pessoa (pessoa_local pelo CPF).
      cpf: cpfSchema.nullable(),
    }),
  ]),
  respostas: respostasSchema,
});
export type InscricaoEntrada = z.infer<typeof inscricaoEntradaSchema>;

export const estimativaSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("posicao"),
    posicao: z.number().int(),
    minutos: z.number().int(),
    consulta: z.object({ minutos: z.number() }).optional(),
  }),
  z.object({ tipo: z.literal("venha_agora"), consulta: z.object({ minutos: z.number() }).optional() }),
  z.object({ tipo: z.literal("aguardando_inicio") }),
  z.object({ tipo: z.literal("modo_manual") }),
  z.object({ tipo: z.literal("chamado") }),
  z.object({ tipo: z.literal("fora_da_fila") }),
]);

/** O que o app mostra de cada entrada do paciente (INV-06: só dele). Mesmo formato que o SSE terá (PD-33). */
export const minhaEntradaSchema = z.object({
  entradaId: z.uuid(),
  pessoa: z.string(),
  estado: z.string(),
  servico: z.string(),
  unidade: z.string(),
  sessao: z.object({ id: z.uuid(), inicio: z.iso.datetime(), fim: z.iso.datetime(), estado: z.string() }).nullable(),
  senha: z.string().nullable(),
  itemEstado: estadoItemSchema.nullable(),
  estimativa: estimativaSchema.nullable(),
  chamada: z.object({ estacao: z.string(), em: z.iso.datetime() }).nullable(),
  pendencias: z.array(z.string()),
  /** RN-ETA-03: o "saia de casa" desta etapa já saiu; a tela diz o mesmo que o push. */
  saiaDeCasa: z.boolean(),
  /** RN-CONF-01: alocada à espera da resposta; até quando confirmar. `null` fora disso. */
  prazoConfirmacao: z.iso.datetime().nullable(),
  /** Serviço da inscrição: uma pessoa só tem uma inscrição ativa por serviço (AD-032). */
  servicoId: z.uuid(),
  /** A pessoa atendida é o dono da conta (e não alguém que ele inscreveu). */
  paraMim: z.boolean(),
  /** Nascimento da pessoa atendida: "mesma pessoa" é CPF ou nome + nascimento (RN-LE-02). */
  nascimento: z.string(),
  /** RN-CANC-01: o "não vou poder ir" vale aqui (remanejada usa "desistir", ainda sem tela). */
  podeCancelar: z.boolean(),
  /** Etapa em que está na fila do dia (triagem ou atendimento); `null` fora da fila. */
  etapa: etapaSchema.nullable(),
  /** Já passou pela triagem hoje (RN-TRI-04). A cor não vai para o app (H5). */
  triado: z.boolean(),
  /** A triagem encaminhou à emergência (H2). */
  encaminhado: z.boolean(),
});
export type MinhaEntrada = z.infer<typeof minhaEntradaSchema>;

export const inscricaoSchema = z.object({
  entradaId: z.uuid(),
  estado: z.string(),
  classificacao: z.object({ nivel: z.string(), apoio: z.boolean() }),
});

/** T5.1 / I1: serviço da unidade para o app, com o modo de marcação (RN-ENC-05); sem dado de paciente. */
export const servicoDaUnidadeSchema = z.object({
  id: z.uuid(),
  nome: z.string(),
  modo: z.enum(["livre", "requisicao", "regulado"]),
});
export type ServicoDaUnidade = z.infer<typeof servicoDaUnidadeSchema>;

/** RN-RISCO-03: refazer o questionário de quem está na lista. */
export const questionarioEntradaSchema = z.object({ respostas: respostasSchema });
export const questionarioRefeitoSchema = z.object({
  classificacao: z.object({ nivel: z.string(), apoio: z.boolean() }),
});

/** RN-FILA-05: resultado da conferência da recepção ao marcar presença. */
export const presencaEntradaSchema = z.object({
  entradaId: z.uuid(),
  resultado: z.enum(["confere", "nao_confere", "prioridade_nao_confere"]),
  motivo: z.string().trim().min(1).optional(),
});

/** O dia da unidade para a equipe: sessões de hoje (com o nome do serviço) e as estações. */
export const hojeNaUnidadeSchema = z.object({
  sessoes: z.array(sessaoSchema.extend({ servico: z.string() })),
  estacoes: z.array(z.object({ id: z.uuid(), nome: z.string(), etapa: etapaSchema })),
});
export type HojeNaUnidade = z.infer<typeof hojeNaUnidadeSchema>;

/** Fila do dia (caminho C): a unidade inteira numa resposta — as sessões de hoje e as pessoas de todas. */
export const filaDeHojeSchema = z.object({
  agora: z.iso.datetime(),
  sessoes: z.array(
    sessaoSchema.extend({
      servico: z.string(),
      reserva: z.number().int().min(0),
      contagens: z.object({
        naFila: z.number().int(),
        naUnidade: z.number().int(),
        aCaminho: z.number().int(),
        chamados: z.number().int(),
        atendidos: z.number().int(),
      }),
    }),
  ),
  itens: z.array(
    itemDaFilaSchema.extend({
      sessaoId: z.uuid(),
      servico: z.string(),
      /** Chamado: hora da chamada; na unidade: desde quando está presente; senão (ou dia antigo) `null`. */
      desde: z.iso.datetime().nullable(),
      /** Sala de quem está chamado. */
      estacao: z.string().nullable(),
    }),
  ),
});
export type FilaDeHoje = z.infer<typeof filaDeHojeSchema>;
export type SessaoDeHoje = FilaDeHoje["sessoes"][number];
export type ItemDeHoje = FilaDeHoje["itens"][number];

/** QR de entrada da unidade (RN-PRES-01): link que abre o app; muda a cada `intervaloSegundos`. */
export const qrDaUnidadeSchema = z.object({
  conteudo: z.string().nullable(),
  intervaloSegundos: z.number().int().min(1),
  expiraEm: z.iso.datetime().nullable(),
  sessoes: z.array(z.object({ id: z.uuid(), servico: z.string() })),
});
export type QrDaUnidade = z.infer<typeof qrDaUnidadeSchema>;

export const checkInEntradaSchema = z.object({
  unidadeId: z.uuid(),
  tokens: z.array(z.string().max(64)).min(1).max(20),
});
export type CheckInEntrada = z.infer<typeof checkInEntradaSchema>;

export const pendenciaSchema = z.enum(["conta", "pessoa_atendida", "pre_cadastro", "prioridade"]);

/** Resultado do check-in por pessoa da conta: presente, ou recusado com as pendências (RN-FILA-05). */
export const checkInSchema = z.array(
  z.object({
    entradaId: z.uuid(),
    pessoa: z.string(),
    senha: z.string(),
    resultado: z.enum(["presente", "pendencia", "ja_na_unidade", "chamado"]),
    pendencias: z.array(pendenciaSchema),
  }),
);
export type CheckIn = z.infer<typeof checkInSchema>;

/** T5.3 / RN-AL-01..06: a sessão privada vista pelo agendador: vagas, alocados e a sugestão com motivos. */
export const alocacaoDaSessaoSchema = z.object({
  sessao: z.object({
    id: z.uuid(),
    servico: z.object({ id: z.uuid(), nome: z.string() }),
    inicio: z.iso.datetime(),
    fim: z.iso.datetime(),
    vagas: z.number().int().nullable(),
    ocupadas: z.number().int(),
    estado: z.string(),
    visibilidade: z.enum(["publica", "privada"]),
    /** Planejada, privada, até a véspera (RN-AL-05) e com vaga (RN-AL-06). */
    podeAlocar: z.boolean(),
    motivo: z.string().nullable(),
  }),
  alocados: z.array(
    z.object({
      entradaId: z.uuid(),
      nome: z.string(),
      idade: z.number().int(),
      estado: z.string(),
      /** RN-CONF-01: 24 h da alocação, sem passar do início; só enquanto pendente. */
      prazo: z.iso.datetime().nullable(),
      destacada: z.boolean(),
    }),
  ),
  sugestao: z.array(
    z.object({
      entradaId: z.uuid(),
      nome: z.string(),
      idade: z.number().int(),
      motivos: z.array(z.string()),
      /** I4: urgente sugerido ainda não alocado. */
      alerta: z.boolean(),
      /** RN-RISCO-06: só agendador e triagem veem. */
      autolesao: z.boolean(),
      /** Pessoa local sem conta: não vê o app nem recebe push (a ligação é o caminho). */
      semApp: z.boolean(),
      faltas: z.number().int(),
      /** RN-FALTA-03 / I10. */
      alertaFaltas: z.boolean(),
      risco: z.object({ nivel: z.string(), confirmado: z.boolean(), regra: z.string() }),
    }),
  ),
});
export type AlocacaoDaSessao = z.infer<typeof alocacaoDaSessaoSchema>;

export const alocarEntradaSchema = z.object({ entradaId: z.uuid() });

/** RN-CONF-02 / I6: o que o agendador registra depois de ligar. */
export const respostaDoAgendadorSchema = z.object({ resposta: z.enum(["confirmou", "recusou", "sem_contato"]) });
export const respostaRegistradaSchema = z.object({ estado: z.string() });

/** RN-CONF-03: alocação pendente para ligar. */
export const itemDeLigacaoSchema = z.object({
  entradaId: z.uuid(),
  nome: z.string(),
  /** Do responsável com conta; pessoa local sem conta não tem. */
  telefone: z.string().nullable(),
  servico: z.string(),
  sessao: z.object({ id: z.uuid(), inicio: z.iso.datetime() }),
  alocadaEm: z.iso.datetime(),
  prazo: z.iso.datetime(),
  destacada: z.boolean(),
  ultimaTentativa: z.iso.datetime().nullable(),
});
export type ItemDeLigacao = z.infer<typeof itemDeLigacaoSchema>;

/** Lista de espera da unidade por serviço, com as sessões privadas em que dá para alocar. */
export const listaDeEsperaDoServicoSchema = z.object({
  servico: z.object({ id: z.uuid(), nome: z.string(), modo: z.enum(["livre", "requisicao", "regulado"]) }),
  aguardando: z.number().int(),
  alertas: z.number().int(),
  sessoes: z.array(
    z.object({
      id: z.uuid(),
      inicio: z.iso.datetime(),
      fim: z.iso.datetime(),
      vagas: z.number().int().nullable(),
      ocupadas: z.number().int(),
      /** Para as barrinhas: quem já confirmou e quem foi alocado e não respondeu. */
      confirmadas: z.number().int(),
      pendentes: z.number().int(),
      profissional: z.string().nullable(),
    }),
  ),
});
export type ListaDeEsperaDoServico = z.infer<typeof listaDeEsperaDoServicoSchema>;
