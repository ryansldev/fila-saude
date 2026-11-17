import { applyTransition, ENTRY_TRANSITIONS, type EntryState, singleTransition, type Transition } from "./contracts.ts";
import { type Answers, type Classification, isUrgent, type RiskLevel, type UnitConfig } from "./kinds.ts";
import { compareSuggestion, type Risk, type SuggestionKey } from "./order.ts";
import { type Group, groupFromDeclared, type LegalPriority, personPriority, toVerify } from "./priority.ts";
import { classify } from "./questionnaire.ts";
import { DEFAULT_CONFIG, type SessionDay } from "./queue.ts";
import { type Event, failure, ok, type Result } from "./result.ts";
import { ageAt, sameDay } from "./time.ts";

/** Pessoa atendida (AD-018): pode não ser o dono da conta (responsável). */
export type Person = { name: string; birthDate: string; cpf: string | null };

export type Entry = {
  id: string;
  serviceId: string;
  /** Conta que recebe os pushes; `null` para pessoa local criada pela recepção (RN-LE-04). */
  guardianId: string | null;
  person: Person;
  state: EntryState;
  /** Nunca muda (INV-09). */
  originalEntryDate: number;
  /** Nível sugerido pelo questionário (RN-RISCO-01). */
  classification: Classification;
  /** Gravado só por agendador ou triagem (INV-07). */
  confirmedRisk: RiskLevel | null;
  /**
   * Prioridade guardada: só os grupos declarados (ou dados pela recepção) e a conferência deles,
   * que vale nas próximas idas até o prazo (AD-024). Idoso e idoso80 não ficam aqui: vêm da data
   * de nascimento em cada uso (`entryPriority`, AD-027).
   */
  priority: LegalPriority;
  /** Origem da remanejada (RN-REM-03); `null` = não remanejada. */
  reassigned: null | Origin;
  refusals: number;
  sessionId: string | null;
  allocatedAt: number | null;
  /** Última pergunta "ainda precisa?" (RN-PARADA-01). */
  askedAt: number | null;
  /** Última resposta "ainda preciso" (ou reativação); a pergunta está pendente se é anterior a `askedAt`. */
  answeredAt: number | null;
  /** Quando foi arquivada (RN-PARADA-02); conta o prazo de reativação. */
  archivedAt: number | null;
  /** Sessões cuja alocação recusou: não volta a ser sugerida para elas (RN-CONF-04 "sugere o próximo"). */
  refusedSessions: string[];
};

/** Origem do remanejado (RN-REM-03): decide o que a 2ª "Outra data" faz. */
export type Origin = "private" | "public" | "regulated";

export type Service = { id: string; mode: "direct" | "referral" | "regulated"; requiresTriage: boolean };

export type SessionSlots = {
  id: string;
  serviceId: string;
  visibility: "public" | "private";
  /** `null` = sem limite de vagas. */
  slots: number | null;
  start: number;
  taken: number;
};

/**
 * Formato único de toda saída que libera vaga (recusa, "Outra data", "Desistir", cancelamento do
 * paciente, remoção de lançamento): a entrada nova, a sessão **já com a vaga liberada** e o dia
 * sem o item (ou como veio). Regra para quem chama: depois de qualquer saída, chame
 * `fillFromReserve` com a sessão devolvida (RN-PUB-02, RN-CANC-02); nunca libere de novo.
 * `sessao` só é `null` em saída de quem não tinha vaga (ex.: desistir sem data).
 */
export type Exit<S extends SessionSlots | null = SessionSlots> = { entry: Entry; session: S; day: SessionDay | null };

export type Suggestion = { entryId: string; reasons: string[] };

export type CallListItem = { entryId: string; sessionId: string; deadline: number; highlighted: boolean };

const H = 3_600_000;
const DAY = 24 * H;
/** Prazo para reativar uma entrada arquivada (RN-PARADA-02, proposta). */
const REACTIVATE_DAYS = 30;

const INACTIVE: EntryState[] = ["cancelled", "completed", "closed_without_care", "archived"];

const EVENT_CREATES = "Paciente ou recepção cria";
const EVENT_EMERGENCY = "Questionário = Emergência";
const EVENT_ALLOCATES = "Agendador aloca";
const EVENT_CONFIRMS = "Paciente ou agendador confirma";
const EVENT_REFUSES = "Recusa";
const EVENT_OTHER_DATE = '"Outra data"';
const EVENT_OPENS_WITHOUT_CONFIRMATION = "Sessão abre sem confirmação";
const EVENT_ASKS = "A cada 30 dias na lista";
const EVENT_ARCHIVES = "7 dias sem resposta";
const EVENT_REACTIVATES = "Paciente reativa";

/**
 * Destino da única linha do contrato que casa com (de, evento) e com o filtro da condição;
 * usado quando a transição depende da condição (vários destinos para o mesmo evento).
 * Escolhe a linha com `transicaoUnica` (o mesmo seletor da fase 2); lança sem linha ou com mais de uma.
 */
export function destinationByCondition(
  de: EntryState | "—",
  event: string,
  filter: (t: Transition<EntryState>) => boolean,
): EntryState | "(mesmo)" | null {
  const row = singleTransition(ENTRY_TRANSITIONS, de, event, filter);
  if (!row) throw new Error(`contrato: sem linha única para "${de}" com "${event}"`);
  return row.for === "(não cria)" ? null : row.for;
}

const normalizeName = (name: string): string =>
  name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

const digits = (cpf: string): string => cpf.replace(/\D/g, "");

/** RN-LE-02: a mesma pessoa atendida, pelo CPF quando os dois têm; senão, por nome + nascimento. */
function samePerson(a: Person, b: Person): boolean {
  if (a.cpf && b.cpf) return digits(a.cpf) === digits(b.cpf);
  return a.birthDate === b.birthDate && normalizeName(a.name) === normalizeName(b.name);
}

/** Entrada ativa da pessoa atendida no serviço (INV-01), para mostrar a existente ao recusar a duplicada. */
export function activeEntryOf(entries: Entry[], person: Person, serviceId: string): Entry | undefined {
  return entries.find((e) => e.serviceId === serviceId && !INACTIVE.includes(e.state) && samePerson(e.person, person));
}

/**
 * RN-LE-01/02/03/05: cria a entrada da pessoa atendida com o nível sugerido e a prioridade
 * declarada (a idade entra em cada uso, AD-027). Regulado e emergência não criam; duplicada é recusada.
 */
export function createEntry(
  activeEntries: Entry[],
  cmd: { service: Service; person: Person; guardianId: string | null; answers: Answers; id: string },
  now: number,
  config: UnitConfig = DEFAULT_CONFIG,
): Result<Entry> {
  const { service, person, answers } = cmd;
  if (service.mode === "regulated") return failure("regulated_service");
  const classification = classify(answers, ageAt(person.birthDate, now, config.timeZone));
  if (classification.level === "emergency") {
    if (destinationByCondition("—", EVENT_EMERGENCY, () => true) !== null) throw new Error("contrato: emergência cria");
    return failure("emergency");
  }
  if (activeEntryOf(activeEntries, person, service.id)) return failure("duplicate");

  const withReferral = service.mode === "referral";
  const state = destinationByCondition("—", EVENT_CREATES, (t) =>
    t.condition.includes(withReferral ? "com requisição" : "sem requisição"),
  );
  if (state === null || state === "(mesmo)") throw new Error("contrato: criação sem estado");

  const declared: Group[] = [...new Set(answers.groups.map(groupFromDeclared))];
  const entry: Entry = {
    id: cmd.id,
    serviceId: service.id,
    guardianId: cmd.guardianId,
    person: { ...person },
    state,
    originalEntryDate: now,
    classification,
    confirmedRisk: null,
    priority: { groups: declared, verified: false, verifiedAt: null },
    reassigned: null,
    refusals: 0,
    sessionId: null,
    allocatedAt: null,
    askedAt: null,
    answeredAt: null,
    archivedAt: null,
    refusedSessions: [],
  };
  const events: Event[] = [{ kind: "entry_created", entryId: entry.id, data: { state } }];
  if (classification.level === "urgent") {
    events.push({ kind: "scheduler_alert", entryId: entry.id, reason: classification.rule });
  }
  return ok(entry, events);
}

/**
 * Prioridade legal da entrada em `agora` (AD-027, RN-RISCO-04): idoso/idoso80 pela idade de agora
 * no fuso da unidade, mais os grupos guardados, com a conferência guardada (AD-024).
 */
export function entryPriority(e: Entry, now: number, timeZone: string): LegalPriority {
  return { ...e.priority, groups: personPriority(e.person, e.priority.groups, now, timeZone) };
}

/**
 * Guarda na entrada a conferência que a recepção fez no item (RN-FILA-05, AD-024): grupos
 * conferidos, retirados ou dados, e a hora. Chame depois de `verifyAndMark` ou `darPrioridade`.
 */
export function verificationInEntry(e: Entry, item: { entryId: string; priority: LegalPriority }): Entry {
  if (item.entryId !== e.id) throw new Error(`item da entrada ${item.entryId}, não de ${e.id}`);
  const p = item.priority;
  return { ...e, priority: { groups: toVerify(p), verified: p.verified, verifiedAt: p.verifiedAt } };
}

/** Risco vigente: confirmado, se houver; senão, sugerido (emergência sugerida não fica na lista). */
export function currentRisk(e: Entry): Risk {
  if (e.confirmedRisk !== null) return e.confirmedRisk;
  const level = e.classification.level;
  return level === "emergency" ? "urgent" : level;
}

const suggestionKey = (e: Entry, now: number, timeZone: string): SuggestionKey => ({
  confirmedUrgency: isUrgent(e.confirmedRisk),
  reassigned: e.reassigned !== null,
  risk: currentRisk(e),
  priority: entryPriority(e, now, timeZone),
  originalEntryDate: e.originalEntryDate,
  id: e.id,
});

const RISK_LABEL: Record<Risk, string> = {
  emergency: "emergência",
  very_urgent: "muito urgente",
  urgent: "urgente",
  attention: "atenção",
  routine: "rotina",
};

const GROUP_LABEL: Record<Exclude<Group, "elderly" | "elderly80">, string> = {
  pregnant: "gestante",
  breastfeeding: "lactante",
  infant: "criança de colo",
  disability: "pessoa com deficiência",
  autism: "TEA",
  mobility: "mobilidade reduzida",
  donor: "doador de sangue",
  obesity: "obesidade",
};

function reasons(e: Entry, now: number, timeZone: string): string[] {
  const m = [`${RISK_LABEL[currentRisk(e)]} ${e.confirmedRisk ? "confirmado" : "sugerido"}`];
  if (e.reassigned !== null) m.push("remanejada");
  for (const g of entryPriority(e, now, timeZone).groups) {
    m.push(
      g === "elderly" || g === "elderly80"
        ? `pessoa idosa, ${ageAt(e.person.birthDate, now, timeZone)} anos`
        : GROUP_LABEL[g],
    );
  }
  m.push(`espera há ${Math.floor((now - e.originalEntryDate) / DAY)} dias`);
  return m;
}

/**
 * RN-AL-01/02: entradas do serviço que podem ocupar as vagas (aguardando ou remanejadas, sem ter
 * recusado esta sessão), na ordem da sugestão, com os motivos. Nada é alocado aqui (INV-08).
 */
export function suggest(entries: Entry[], session: SessionSlots, config: UnitConfig, now: number): Suggestion[] {
  return entries
    .filter(
      (e) =>
        e.serviceId === session.serviceId &&
        applyTransition(ENTRY_TRANSITIONS, e.state, EVENT_ALLOCATES) === "allocated" &&
        !e.refusedSessions.includes(session.id),
    )
    .sort((a, b) =>
      compareSuggestion(
        suggestionKey(a, now, config.timeZone),
        suggestionKey(b, now, config.timeZone),
        config.municipalityOrder,
      ),
    )
    .map((e) => ({ entryId: e.id, reasons: reasons(e, now, config.timeZone) }));
}

/** RN-CONF-01: 24 h da alocação, sem passar do início da sessão. */
export function confirmationDeadline(entry: Entry, session: SessionSlots, config: UnitConfig): number {
  if (entry.allocatedAt === null) throw new Error(`entrada ${entry.id} não está alocada`);
  return Math.min(entry.allocatedAt + config.confirmationDeadlineHours * H, session.start);
}

/**
 * Agendador aloca (RN-AL-04/05/06, RN-RISCO-01): só em sessão privada do serviço, até a véspera
 * no fuso da unidade, com vaga livre. O nível vira confirmado (o do agendador, se ele alterou).
 */
export function allocate(
  entry: Entry,
  session: SessionSlots,
  // RN-RISCO-01 (2026-11-13): o agendador não confirma risco; só o enfermeiro (triagem).
  _cmd: Record<string, never>,
  now: number,
  config: UnitConfig = DEFAULT_CONFIG,
): Result<{ entry: Entry; session: SessionSlots }> {
  if (entry.serviceId !== session.serviceId || session.visibility !== "private") return failure("forbidden_transition");
  if (applyTransition(ENTRY_TRANSITIONS, entry.state, EVENT_ALLOCATES) !== "allocated")
    return failure("forbidden_transition");
  // Emergência não entra em lista nem fila (RN-LE-01), como em `registerRegulated`.
  if (now >= session.start || sameDay(now, session.start, config.timeZone)) return failure("past_deadline");
  if (session.slots !== null && session.taken >= session.slots) return failure("no_slot");

  const fresh: Entry = {
    ...entry,
    state: "allocated",
    sessionId: session.id,
    allocatedAt: now,
    confirmedRisk: entry.confirmedRisk,
  };
  const deadline = confirmationDeadline(fresh, session, config);
  return ok({ entry: fresh, session: { ...session, taken: session.taken + 1 } }, [
    { kind: "allocated", entryId: entry.id, sessionId: session.id, data: { deadline } },
  ]);
}

const allocatedHere = (entry: Entry, session: SessionSlots): boolean =>
  entry.state === "allocated" && entry.sessionId === session.id;

/** RN-CONF-01/02: paciente ou agendador confirma; depois das 24 h ainda vale, até a abertura. */
export function confirm(entry: Entry, session: SessionSlots, now: number): Result<Entry> {
  if (!allocatedHere(entry, session)) return failure("forbidden_transition");
  if (applyTransition(ENTRY_TRANSITIONS, entry.state, EVENT_CONFIRMS) !== "confirmed") {
    return failure("forbidden_transition");
  }
  if (now >= session.start) return failure("past_deadline");
  return ok({ ...entry, state: "confirmed" }, [{ kind: "confirmed", entryId: entry.id, sessionId: session.id }]);
}

/** Qualificador da linha de 2ª "Outra data" (RN-REM-03), pela origem da remanejada. */
const SECOND_REFUSAL_QUALIFIER: Record<Origin, string> = {
  private: "remanejada de sessão privada",
  public: "remanejada de sessão pública, alocada numa privada",
  regulated: "remanejada, serviço regulado",
};

/**
 * Fonte única do "Outra data" (RN-REM-03): destino da remanejada no estado `de`, pela vez
 * (`recusas` = 0 → 1ª) e pela origem. `null` quando o contrato não tem a linha para esse estado
 * (transição proibida); lança se o texto do contrato mudou e a linha ficou ambígua ou sumiu.
 */
export function otherDateDestination(de: EntryState, refusals: number, origin: Origin): EntryState | null {
  const condition = refusals === 0 ? "1ª recusa" : "2ª recusa";
  const rows = ENTRY_TRANSITIONS.filter(
    (t) => t.de === de && t.event === EVENT_OTHER_DATE && t.condition === condition,
  );
  if (rows.length === 0) return null;
  const match = refusals === 0 ? rows : rows.filter((t) => t.qualifier === SECOND_REFUSAL_QUALIFIER[origin]);
  const [row] = match;
  if (!row || match.length > 1 || row.for === "(mesmo)" || row.for === "(não cria)") {
    throw new Error(`contrato: sem linha única de "Outra data" (${condition}) para "${de}", origem ${origin}`);
  }
  return row.for;
}

/** Aviso da remanejada encerrada por "Outra data" ou "Desistir", pela origem (RN-REM-03). */
const CANCELLED_REASON: Record<Origin, string | undefined> = {
  private: undefined,
  public: "inscreva-se de novo",
  regulated: "comunicar a regulação",
};

/**
 * Núcleo do "Outra data" (RN-REM-03) na sessão da entrada: só em sessão privada (a regulada é
 * privada); a vaga é liberada e a sessão não volta a ser sugerida. Usado por `recusar` (remanejada
 * alocada) e por `otherDate` (encerramento.ts), que acrescenta a saída da fila do dia.
 */
export function otherDateInSession(
  entry: Entry,
  session: SessionSlots,
  now: number,
): Result<{ entry: Entry; session: SessionSlots }> {
  const origin = entry.reassigned;
  if (origin === null || entry.sessionId !== session.id || session.visibility !== "private") {
    return failure("forbidden_transition");
  }
  const to = otherDateDestination(entry.state, entry.refusals, origin);
  if (to === null) return failure("forbidden_transition");
  const fresh: Entry = {
    ...entry,
    state: to,
    sessionId: null,
    allocatedAt: null,
    refusals: entry.refusals + 1,
    reassigned: to === "reassigned" ? origin : null,
    refusedSessions: [...entry.refusedSessions, session.id],
  };
  const ids = { entryId: entry.id, sessionId: session.id };
  const events: Event[] = [
    { kind: "refused", ...ids, data: { for: to, at: now } },
    { kind: "slot_released", ...ids },
  ];
  const reason = CANCELLED_REASON[origin];
  if (to === "cancelled") events.push({ kind: "cancelled", ...ids, ...(reason === undefined ? {} : { reason }) });
  return ok({ entry: fresh, session: { ...session, taken: Math.max(0, session.taken - 1) } }, events);
}

/**
 * RN-CONF-04: a recusa libera a vaga na hora (formato `Exit`, sem dia: alocada não tem item) e
 * a entrada não volta a ser sugerida para esta sessão; não remanejada volta à lista com a data original. Remanejada alocada: é o "Outra data"
 * (RN-REM-03) e delega a `otherDateInSession`. O app chama `otherDate` (encerramento.ts) para
 * qualquer remanejada com data, inclusive alocada; `recusar` dá o mesmo resultado para ela.
 */
export function refuse(entry: Entry, session: SessionSlots, now: number): Result<Exit> {
  if (!allocatedHere(entry, session)) return failure("forbidden_transition");
  if (entry.reassigned !== null) {
    const r = otherDateInSession(entry, session, now);
    return r.ok ? ok({ ...r.state, day: null }, r.events) : r;
  }
  const to = applyTransition(ENTRY_TRANSITIONS, entry.state, EVENT_REFUSES);
  if (to !== "waiting") return failure("forbidden_transition");

  const fresh: Entry = {
    ...entry,
    state: to,
    sessionId: null,
    allocatedAt: null,
    refusedSessions: [...entry.refusedSessions, session.id],
  };
  const ids = { entryId: entry.id, sessionId: session.id };
  return ok({ entry: fresh, session: { ...session, taken: Math.max(0, session.taken - 1) }, day: null }, [
    { kind: "refused", ...ids, data: { for: to, at: now } },
    { kind: "slot_released", ...ids },
  ]);
}

/**
 * RN-CONF-03: alocações pendentes, pela sessão mais próxima; destacada a partir do prazo de
 * confirmação (24 h, ou o início da sessão, se vier antes).
 */
export function callList(entries: Entry[], sessions: SessionSlots[], config: UnitConfig, now: number): CallListItem[] {
  const items: (CallListItem & { start: number })[] = [];
  for (const e of entries) {
    const session = sessions.find((s) => s.id === e.sessionId);
    if (!session || !allocatedHere(e, session)) continue;
    const deadline = confirmationDeadline(e, session, config);
    items.push({ entryId: e.id, sessionId: session.id, deadline, highlighted: now >= deadline, start: session.start });
  }
  return items
    .sort((a, b) => a.start - b.start || a.deadline - b.deadline || (a.entryId < b.entryId ? -1 : 1))
    .map(({ start: _, ...item }) => item);
}

/** RN-CONF-04: na abertura, alocações ainda pendentes desta sessão voltam à lista com a data original. */
export function pendingAtOpening(
  entries: Entry[],
  session: SessionSlots,
): Result<{ entries: Entry[]; session: SessionSlots }> {
  const events: Event[] = [];
  const fresh = entries.map((e) => {
    if (!allocatedHere(e, session)) return e;
    const to = applyTransition(ENTRY_TRANSITIONS, e.state, EVENT_OPENS_WITHOUT_CONFIRMATION);
    if (to !== "waiting") throw new Error(`contrato: alocada não volta à lista na abertura (${to})`);
    events.push({
      kind: "slot_released",
      entryId: e.id,
      sessionId: session.id,
      reason: "sessão abriu sem confirmação",
    });
    return { ...e, state: to, sessionId: null, allocatedAt: null };
  });
  return ok({ entries: fresh, session: { ...session, taken: Math.max(0, session.taken - events.length) } }, events);
}

const pendingQuestion = (e: Entry): boolean =>
  e.askedAt !== null && (e.answeredAt === null || e.answeredAt < e.askedAt);

/**
 * RN-PARADA-01: a cada 30 dias na lista (desde a entrada, a última pergunta ou a última resposta),
 * pergunta "ainda precisa?". Com a pergunta pendente, não pergunta de novo.
 */
export function askStillNeeds(entry: Entry, config: UnitConfig, now: number): Result<Entry> {
  if (applyTransition(ENTRY_TRANSITIONS, entry.state, EVENT_ASKS) !== "(mesmo)") {
    return failure("forbidden_transition");
  }
  const since = Math.max(entry.originalEntryDate, entry.askedAt ?? 0, entry.answeredAt ?? 0);
  if (pendingQuestion(entry) || now - since < config.stillNeeds.intervalDays * DAY) {
    return failure("past_deadline");
  }
  return ok({ ...entry, askedAt: now }, [{ kind: "still_needs", entryId: entry.id }]);
}

/** Resposta "ainda preciso": a entrada segue na lista e a próxima pergunta conta daqui. */
export function answerStillNeeds(entry: Entry, now: number): Result<Entry> {
  if (entry.state !== "waiting" || !pendingQuestion(entry)) return failure("forbidden_transition");
  return ok({ ...entry, answeredAt: now });
}

/** RN-PARADA-02: 7 dias sem resposta arquiva (não apaga) e avisa o paciente. */
export function archive(entry: Entry, config: UnitConfig, now: number): Result<Entry> {
  if (applyTransition(ENTRY_TRANSITIONS, entry.state, EVENT_ARCHIVES) !== "archived") {
    return failure("forbidden_transition");
  }
  const askedAt = entry.askedAt;
  if (askedAt === null || !pendingQuestion(entry) || now - askedAt < config.stillNeeds.deadlineDays * DAY) {
    return failure("past_deadline");
  }
  return ok({ ...entry, state: "archived", archivedAt: now }, [{ kind: "archived", entryId: entry.id }]);
}

/**
 * RN-PARADA-02 (proposta): reativa em até 30 dias do arquivamento, com a data original, exceto se
 * o serviço virou regulado. A reativação vale como resposta "ainda preciso". Recusa se a pessoa
 * já tem outra entrada ativa no serviço (INV-01).
 */
export function reactivate(activeEntries: Entry[], entry: Entry, service: Service, now: number): Result<Entry> {
  if (applyTransition(ENTRY_TRANSITIONS, entry.state, EVENT_REACTIVATES) !== "waiting") {
    return failure("forbidden_transition");
  }
  if (service.mode === "regulated") return failure("regulated_service");
  if (entry.archivedAt === null || now - entry.archivedAt > REACTIVATE_DAYS * DAY) return failure("past_deadline");
  const others = activeEntries.filter((e) => e.id !== entry.id);
  if (activeEntryOf(others, entry.person, entry.serviceId)) return failure("duplicate");
  return ok({ ...entry, state: "waiting", archivedAt: null, answeredAt: now }, [
    { kind: "reactivated", entryId: entry.id },
  ]);
}
