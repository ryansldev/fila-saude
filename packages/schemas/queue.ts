import z from "zod";
import { birthDateSchema } from "./auth";
import { cpfSchema } from "./cpf";
import { sessionSchema } from "./session";

// Fatia 1 da v0.1: fila do dia (painel), operação da estação e as telas do app.

export const stageSchema = z.enum(["triage", "care"]);
export const itemStateSchema = z.enum(["remote", "present", "called", "done_in_stage", "left_queue", "reassigned"]);

/** Quem inscreve outra pessoa diz o que é dela (2026-11-16; texto da declaração provisório até o D5). */
export const relationshipSchema = z.enum(["legal_guardian", "caregiver", "family_or_friend"]);
export type Relationship = z.infer<typeof relationshipSchema>;

/** Item da fila como o painel vê: nome para a equipe; nada clínico além do nível de risco usado na ordem. */
export const queueItemSchema = z.object({
  id: z.string(),
  entryId: z.uuid(),
  ticket: z.string(),
  name: z.string(),
  stage: stageSchema,
  state: itemStateSchema,
  skips: z.number().int().min(0),
  risk: z.enum(["emergency", "very_urgent", "urgent", "attention", "routine"]),
  priority: z.boolean(),
  stationId: z.string().nullable(),
  /** RN-FILA-05: o que a recepção precisa conferir antes da presença. */
  pendingChecks: z.array(z.string()),
  /** RN-PRES-03: para comparar com o documento; CPF mascarado (LGPD), só os dígitos do meio. */
  /** Só para quem pode ver documentos na unidade (recepção, agendar); para os outros, `null` (RN-PERF-01). */
  document: z.object({ birthDate: z.string(), cpf: z.string().nullable() }).nullable(),
  /**
   * Inscrita por outra conta: o primeiro nome de quem inscreveu e a relação (`null` nas inscrições de antes
   * da relação existir). `null` quando foi a própria pessoa.
   */
  guardian: z.object({ name: z.string(), relationship: relationshipSchema.nullable() }).nullable(),
});

export const sessionQueueSchema = z.object({
  session: sessionSchema,
  items: z.array(queueItemSchema),
  reserve: z.number().int().min(0),
});
export type QueueItem = z.infer<typeof queueItemSchema>;
export type SessionQueue = z.infer<typeof sessionQueueSchema>;

export const riskLevelSchema = z.enum(["emergency", "very_urgent", "urgent", "attention", "routine"]);
export type ApiRiskLevel = z.infer<typeof riskLevelSchema>;

/**
 * Só na estação de triagem (RN-RISCO-01, RN-RISCO-06): o que o app sugeriu, a regra que gerou o
 * sugerido, os grupos de prioridade declarados e `apoio` (resposta sobre autolesão: CVV e SAMU).
 */
export const triageFormSchema = z.object({
  suggestedRisk: riskLevelSchema,
  rule: z.string(),
  support: z.boolean(),
});

export const calledSchema = z.object({
  itemId: z.string(),
  ticket: z.string(),
  name: z.string(),
  stage: stageSchema,
  skips: z.number().int().min(0),
  calledAt: z.iso.datetime(),
  toleranceExceeded: z.boolean(),
  /** Hora do "Compareceu" (a pessoa entrou na sala); `null` enquanto esperam ela entrar. */
  showedUpAt: z.iso.datetime().nullable(),
  /** Grupos de prioridade declarados (ex.: "idoso"), em qualquer etapa. */
  priority: z.array(z.string()),
  triage: triageFormSchema.optional(),
});

/**
 * Corpo de "chamar" e "finalizar": na triagem, a cor dada a quem sai (H3: obrigatória com alguém
 * chamado) e, só com vermelho, `encaminhar` à emergência, que tira da fila desta unidade (AD-059).
 */
export const commandBodySchema = z
  .object({
    confirmedRisk: riskLevelSchema.optional(),
    refer: z.boolean().optional(),
    /** Fechar a última estação (RN-EST-07): confirma que encerra a sessão ou fecha a triagem (`station.closing`). */
    confirmed: z.boolean().optional(),
    /** "Pausar" (RN-EST-06): a volta num horário, em minutos contados do início da pausa, ou sem hora (`null`). */
    back: z
      .union([
        z.object({ at: z.iso.datetime() }),
        z.object({
          inMin: z
            .number()
            .int()
            .min(1)
            .max(24 * 60),
        }),
        z.null(),
      ])
      .optional(),
  })
  .default({});

/** Tela da estação (T3.7): a sessão aberta de hoje que ela atende, o chamado e quantos aguardam presentes. */
export const stationOperationSchema = z.object({
  /**
   * `closedAt`: a estação fechou nesta sessão (RN-EST-07), desde quando; `null` aberta. `closing`: o que fechá-la
   * agora faz (é a última do atendimento, encerra a sessão; a última da triagem, fecha a triagem); `null` nada.
   */
  station: z.object({
    id: z.uuid(),
    name: z.string(),
    stage: stageSchema,
    closedAt: z.iso.datetime().nullable(),
    closing: z.enum(["closes_session", "closes_stage"]).nullable(),
    /**
     * A pausa da estação (RN-EST-06): marcada (começa em `from`) ou em curso (desde `from`); `until` nulo, sem hora de
     * volta. Opção C: perguntando (desde `from`), quem chegou no prazo e não foi chamado (`waiting`) e a volta se
     * atender o primeiro deles antes (`untilIfServed`, pelo tempo médio); atendendo antes, a duração da pausa que
     * começa ao finalizar (`lengthMin`, nulo sem hora de volta). `null` sem pausa.
     */
    pause: z
      .discriminatedUnion("state", [
        z.object({
          state: z.enum(["scheduled", "paused"]),
          from: z.iso.datetime(),
          until: z.iso.datetime().nullable(),
        }),
        z.object({
          state: z.literal("asking"),
          from: z.iso.datetime(),
          until: z.iso.datetime().nullable(),
          waiting: z.array(z.object({ ticket: z.string(), name: z.string() })),
          untilIfServed: z.iso.datetime().nullable(),
          /** Alguém dos que esperam pode ser chamado por quem opera esta estação (o técnico não chama o acolhido). */
          canServe: z.boolean(),
        }),
        z.object({ state: z.literal("serving"), lengthMin: z.number().int().min(0).nullable() }),
      ])
      .nullable(),
    /** Se tocar "Pausar" agora, a pausa começa nesta hora (depois do prazo de quem está a caminho); `null` não pausa. */
    pauseStartsAt: z.iso.datetime().nullable(),
  }),
  session: z.object({ id: z.uuid(), service: z.string(), state: z.string() }).nullable(),
  called: calledSchema.nullable(),
  waiting: z.number().int().min(0),
  remote: z.number().int().min(0),
  toleranceMin: z.number().int().min(0),
  /** `session_closed`: fechar a última estação do atendimento acabou de encerrar a sessão (RN-EST-07). */
  notice: z.enum(["nobody_waiting", "session_closed"]).nullable(),
  /** Até 3 presentes, na ordem em que esta estação vai chamar; só o primeiro nome. */
  upcoming: z.array(z.object({ ticket: z.string(), name: z.string(), presentSince: z.iso.datetime() })),
  /** Até 3 a caminho (remotos da etapa), na ordem da fila; só o primeiro nome. */
  onTheWay: z.array(z.object({ ticket: z.string(), name: z.string() })),
  /** Quem espera há mais tempo na unidade e o tempo-alvo dele (min); `null` sem ninguém. */
  oldest: z.object({ presentSince: z.iso.datetime(), targetTimeMin: z.number().int().min(0) }).nullable(),
  /** Hora do servidor: o cronômetro conta por ela (o relógio do computador pode estar errado). */
  now: z.iso.datetime(),
  /** RN-PERF-05: quem opera classifica o risco (enfermeiro); o técnico só acolhe e finaliza sem cor. */
  classifies: z.boolean(),
  /** Fuso da unidade, para as horas da estação (ex.: "fechado às 15:10"); `null` sem sessão aberta. */
  timeZone: z.string().nullable(),
});
export type StationOperation = z.infer<typeof stationOperationSchema>;

export const stationCommandSchema = z.enum([
  "call",
  "recall",
  "finish",
  "no-show",
  "showed-up",
  "undo-showed-up",
  "close",
  "reopen",
  "pause",
  "resume",
  "serve-before-pause",
  "pause-now",
]);
export type StationCommand = z.infer<typeof stationCommandSchema>;

// ---- App do paciente ----

/** Tela 5 (unidades próximas): onde fica cada unidade e quantos atendimentos abertos ela tem. */
export const publicUnitSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: z.string(),
  address: z.object({ street: z.string(), number: z.string(), neighborhood: z.string(), postalCode: z.string() }),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  /** Atendimentos públicos com inscrição aberta (os mesmos da agenda). */
  appointments: z.number().int().min(0),
  /** Fuso da unidade: o app mostra datas e horas nele. */
  timeZone: z.string(),
});
export type PublicUnit = z.infer<typeof publicUnitSchema>;

export const publicMunicipalitySchema = z.object({ slug: z.string(), name: z.string(), uf: z.string().nullable() });

/** Agenda pública (T3.2): só dados da sessão, nunca de paciente. */
export const scheduleSessionSchema = z.object({
  id: z.uuid(),
  unit: z.object({ id: z.uuid(), name: z.string(), neighborhood: z.string(), timeZone: z.string() }),
  service: z.object({ id: z.uuid(), name: z.string() }),
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  professional: z.string().nullable(),
  remainingSlots: z.number().int().min(0).nullable(),
  state: z.enum(["planned", "open"]),
});
export type ScheduleSession = z.infer<typeof scheduleSessionSchema>;

export const answersSchema = z.object({
  alarms: z.array(
    z.enum(["shortness_of_breath", "chest_pain", "fainting", "one_sided_weakness", "bleeding", "seizure", "self_harm"]),
  ),
  reason: z.enum(["new", "follow_up", "exam", "prescription"]),
  severity: z.enum(["mild", "moderate", "severe"]).nullable(),
  conditions: z.array(z.enum(["diabetes", "high_blood_pressure", "heart", "respiratory", "cancer", "low_immunity"])),
  groups: z.array(
    z.enum([
      "pregnant",
      "breastfeeding",
      "infant_in_arms",
      "disability",
      "autism",
      "reduced_mobility",
      "blood_donor",
      "obesity",
    ]),
  ),
});

/** "Para quem é?" (AD-018): eu (dados da conta) ou outra pessoa. */
export const signUpInputSchema = z.object({
  forWhom: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("me") }),
    z.object({
      kind: z.literal("other"),
      name: z.string().trim().min(3).max(200),
      birthDate: birthDateSchema,
      // Opcional, mas quando vem é um CPF válido: senão a inscrição cai em outra pessoa (pessoa_local pelo CPF).
      cpf: cpfSchema.nullable(),
      relationship: relationshipSchema,
      declared: z.literal(true),
    }),
  ]),
  answers: answersSchema,
});
export type SignUpInput = z.infer<typeof signUpInputSchema>;

export const estimateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("position"),
    position: z.number().int(),
    minutes: z.number().int(),
    query: z.object({ minutes: z.number() }).optional(),
    /**
     * A pausa da etapa que atrasa a vez; `until` nulo, sem hora de volta (o tempo não a soma). `beforeTurn`: a
     * pessoa chegou no prazo e a estação pausou antes de chamá-la (opção C, com a justificativa).
     */
    pause: z
      .object({ from: z.number(), until: z.number().nullable(), beforeTurn: z.literal(true).optional() })
      .optional(),
  }),
  z.object({ kind: z.literal("come_now"), query: z.object({ minutes: z.number() }).optional() }),
  z.object({ kind: z.literal("awaiting_start") }),
  z.object({ kind: z.literal("manual_mode") }),
  z.object({ kind: z.literal("called") }),
  z.object({ kind: z.literal("out_of_queue") }),
]);

/** O que o app mostra de cada entrada do paciente (INV-06: só dele). Mesmo formato que o WebSocket terá (PD-33). */
export const myEntrySchema = z.object({
  entryId: z.uuid(),
  person: z.string(),
  state: z.string(),
  service: z.string(),
  unit: z.string(),
  session: z.object({ id: z.uuid(), start: z.iso.datetime(), end: z.iso.datetime(), state: z.string() }).nullable(),
  ticket: z.string().nullable(),
  itemState: itemStateSchema.nullable(),
  estimate: estimateSchema.nullable(),
  call: z.object({ station: z.string(), at: z.iso.datetime() }).nullable(),
  pendingChecks: z.array(z.string()),
  /** RN-ETA-03: o "saia de casa" desta etapa já saiu; a tela diz o mesmo que o push. */
  leaveHome: z.boolean(),
  /** RN-CONF-01: alocada à espera da resposta; até quando confirmar. `null` fora disso. */
  confirmationDeadline: z.iso.datetime().nullable(),
  /** Fuso da unidade: o app mostra datas e horas nele. */
  timeZone: z.string(),
  /** Serviço da inscrição: uma pessoa só tem uma inscrição ativa por serviço (AD-032). */
  serviceId: z.uuid(),
  /** A pessoa atendida é o dono da conta (e não alguém que ele inscreveu). */
  forMe: z.boolean(),
  /** Nascimento da pessoa atendida: "mesma pessoa" é CPF ou nome + nascimento (RN-LE-02). */
  birthDate: z.string(),
  /** RN-REM-03: recusar esta data encerra o pedido (2ª recusa de quem foi remanejado); o app avisa antes. */
  refusalEnds: z.boolean(),
  /** RN-CANC-01: o "não vou poder ir" vale aqui (remanejada usa "desistir", ainda sem tela). */
  canCancel: z.boolean(),
  /** Etapa em que está na fila do dia (triagem ou atendimento); `null` fora da fila. */
  stage: stageSchema.nullable(),
  /** Já passou pela triagem hoje (RN-TRI-04). A cor não vai para o app (H5). */
  triaged: z.boolean(),
  /** A triagem encaminhou à emergência (H2). */
  referred: z.boolean(),
});
export type MyEntry = z.infer<typeof myEntrySchema>;

export const signUpSchema = z.object({
  entryId: z.uuid(),
  state: z.string(),
  classification: z.object({ level: z.string(), support: z.boolean() }),
});

/** T5.1 / I1: serviço da unidade para o app, com o modo de marcação (RN-ENC-05); sem dado de paciente. */
export const unitServiceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mode: z.enum(["direct", "referral", "regulated"]),
});
export type UnitService = z.infer<typeof unitServiceSchema>;

/** RN-RISCO-03: refazer o questionário de quem está na lista. */
export const questionnaireInputSchema = z.object({ answers: answersSchema });
export const redoneQuestionnaireSchema = z.object({
  classification: z.object({ level: z.string(), support: z.boolean() }),
});

/** RN-FILA-05: resultado da conferência da recepção ao marcar presença. */
export const attendanceInputSchema = z.object({
  entryId: z.uuid(),
  result: z.enum(["matches", "does_not_match", "priority_does_not_match"]),
  reason: z.string().trim().min(1).optional(),
});

/** O dia da unidade para a equipe: sessões de hoje (com o nome do serviço) e as estações. */
export const todayInUnitSchema = z.object({
  sessions: z.array(sessionSchema.extend({ service: z.string() })),
  stations: z.array(z.object({ id: z.uuid(), name: z.string(), stage: stageSchema })),
});
export type TodayInUnit = z.infer<typeof todayInUnitSchema>;

/** Fila do dia (caminho C): a unidade inteira numa resposta — as sessões de hoje e as pessoas de todas. */
export const todayQueueSchema = z.object({
  now: z.iso.datetime(),
  sessions: z.array(
    sessionSchema.extend({
      service: z.string(),
      reserve: z.number().int().min(0),
      counts: z.object({
        inQueue: z.number().int(),
        inUnit: z.number().int(),
        onTheWay: z.number().int(),
        called: z.number().int(),
        attended: z.number().int(),
      }),
    }),
  ),
  items: z.array(
    queueItemSchema.extend({
      sessionId: z.uuid(),
      service: z.string(),
      /** Chamado: hora da chamada; na unidade: desde quando está presente; senão (ou dia antigo) `null`. */
      since: z.iso.datetime().nullable(),
      /** Sala de quem está chamado. */
      station: z.string().nullable(),
    }),
  ),
});
export type TodayQueue = z.infer<typeof todayQueueSchema>;
export type TodaySession = TodayQueue["sessions"][number];
export type TodayItem = TodayQueue["items"][number];

/** QR de entrada da unidade (RN-PRES-01): link que abre o app; muda a cada `intervalSeconds`. */
export const unitQrSchema = z.object({
  content: z.string().nullable(),
  intervalSeconds: z.number().int().min(1),
  expiresAt: z.iso.datetime().nullable(),
  /** Hora do servidor na resposta: a barrinha de troca conta por ela, não pelo relógio do computador. */
  now: z.iso.datetime(),
  sessions: z.array(z.object({ id: z.uuid(), service: z.string() })),
});
export type UnitQr = z.infer<typeof unitQrSchema>;

export const checkInInputSchema = z.object({
  unitId: z.uuid(),
  tokens: z.array(z.string().max(64)).min(1).max(20),
});
export type CheckInInput = z.infer<typeof checkInInputSchema>;

export const pendingCheckSchema = z.enum(["account", "attended_person", "pre_registration", "priority"]);

/** Resultado do check-in por pessoa da conta: presente, ou recusado com as pendências (RN-FILA-05). */
export const checkInSchema = z.array(
  z.object({
    entryId: z.uuid(),
    person: z.string(),
    ticket: z.string(),
    result: z.enum(["present", "pending_check", "already_in_unit", "called"]),
    pendingChecks: z.array(pendingCheckSchema),
  }),
);
export type CheckIn = z.infer<typeof checkInSchema>;

/** T5.3 / RN-AL-01..06: a sessão privada vista pelo agendador: vagas, alocados e a sugestão com motivos. */
export const sessionAllocationSchema = z.object({
  session: z.object({
    id: z.uuid(),
    service: z.object({ id: z.uuid(), name: z.string() }),
    start: z.iso.datetime(),
    end: z.iso.datetime(),
    slots: z.number().int().nullable(),
    taken: z.number().int(),
    state: z.string(),
    visibility: z.enum(["public", "private"]),
    /** Planejada, privada, até a véspera (RN-AL-05) e com vaga (RN-AL-06). */
    canAllocate: z.boolean(),
    reason: z.string().nullable(),
  }),
  allocated: z.array(
    z.object({
      entryId: z.uuid(),
      name: z.string(),
      age: z.number().int(),
      state: z.string(),
      /** RN-CONF-01: 24 h da alocação, sem passar do início; só enquanto pendente. */
      deadline: z.iso.datetime().nullable(),
      highlighted: z.boolean(),
    }),
  ),
  suggestion: z.array(
    z.object({
      entryId: z.uuid(),
      name: z.string(),
      age: z.number().int(),
      reasons: z.array(z.string()),
      /** I4: urgente sugerido ainda não alocado. */
      alert: z.boolean(),
      /** RN-RISCO-06: só agendador e triagem veem. */
      selfHarm: z.boolean(),
      /** Pessoa local sem conta: não vê o app nem recebe push (a ligação é o caminho). */
      withoutApp: z.boolean(),
      noShows: z.number().int(),
      /** RN-FALTA-03 / I10. */
      noShowAlert: z.boolean(),
      risk: z.object({ level: z.string(), confirmed: z.boolean(), rule: z.string() }),
    }),
  ),
});
export type SessionAllocation = z.infer<typeof sessionAllocationSchema>;

export const allocateInputSchema = z.object({ entryId: z.uuid() });

/** RN-CONF-02 / I6: o que o agendador registra depois de ligar. */
export const schedulerAnswerSchema = z.object({ answer: z.enum(["confirmed", "refused", "no_contact"]) });
export type SchedulerAnswer = z.infer<typeof schedulerAnswerSchema>["answer"];
export const registeredAnswerSchema = z.object({ state: z.string() });

/** RN-CONF-03: alocação pendente para ligar. */
export const callListItemSchema = z.object({
  entryId: z.uuid(),
  name: z.string(),
  /** Do responsável com conta; pessoa local sem conta não tem. */
  phone: z.string().nullable(),
  service: z.string(),
  session: z.object({ id: z.uuid(), start: z.iso.datetime() }),
  allocatedAt: z.iso.datetime(),
  deadline: z.iso.datetime(),
  highlighted: z.boolean(),
  lastAttempt: z.iso.datetime().nullable(),
});
export type CallListItem = z.infer<typeof callListItemSchema>;

/** Lista de espera da unidade por serviço, com as sessões privadas em que dá para alocar. */
export const serviceWaitlistSchema = z.object({
  service: z.object({ id: z.uuid(), name: z.string(), mode: z.enum(["direct", "referral", "regulated"]) }),
  waiting: z.number().int(),
  alerts: z.number().int(),
  sessions: z.array(
    z.object({
      id: z.uuid(),
      start: z.iso.datetime(),
      end: z.iso.datetime(),
      slots: z.number().int().nullable(),
      taken: z.number().int(),
      /** Para as barrinhas: quem já confirmou e quem foi alocado e não respondeu. */
      confirmed: z.number().int(),
      pending: z.number().int(),
      professional: z.string().nullable(),
    }),
  ),
});
export type ServiceWaitlist = z.infer<typeof serviceWaitlistSchema>;

// RN-CANC-01: resposta do "Não vou poder ir".
export const cancelledSchema = z.object({ state: z.literal("cancelled") });

// "Estou indo"/"saí da unidade": o item volta para casa (remoto).
export const leavingSchema = z.object({ ticket: z.string(), itemState: z.literal("remote") });

// Comandos sem dado de volta.
export const okSchema = z.object({ ok: z.literal(true) });
