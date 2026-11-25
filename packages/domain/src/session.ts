import {
  applyTransition,
  ENTRY_TRANSITIONS,
  type EntryState,
  ITEM_TRANSITIONS,
  type ItemState,
  SESSION_TRANSITIONS,
} from "./contracts.ts";
import { type Answers, isUrgent, type RiskLevel, type UnitConfig } from "./kinds.ts";
import {
  activeEntryOf,
  createEntry,
  currentRisk,
  destinationByCondition,
  type Entry,
  type Exit,
  entryPriority,
  type Person,
  pendingAtOpening,
  type Service,
  type SessionSlots,
} from "./list.ts";
import { hasPriority } from "./priority.ts";
import { classify } from "./questionnaire.ts";
import { DEFAULT_CONFIG, type QueueItem, type SessionDay, stayEligible } from "./queue.ts";
import { type ErrorCode, type Event, failure, ok, type Result } from "./result.ts";
import { ageAt } from "./time.ts";

// Eventos das tabelas de transição (textos copiados das specs).
const SESSION_OPENS = "Horário de início chega, ou admin abre antes";
const ENTRY_SESSION_OPENS = "Sessão abre";
const ENTRY_WITHOUT_ACCEPTANCE = "Sessão abre sem aceite";
const ENTRY_SIGN_UP = "Inscrição pública";
const ENTRY_FROM_RESERVE = "Vaga liberada e é o primeiro da reserva";
const ENTRY_SWAP = "Troca por vaga em outra sessão pública do serviço";
const ENTRY_SAFE_SWAP = "Troca por vaga em serviço com requisição, sem foto aceita";
const ENTRY_ACCEPTED = "Agendador aceita";
const ENTRY_REGISTERS = "Agendador lança (serviço regulado)";
const ENTRY_REMOVE = "Agendador remove lançamento, com motivo";
const ITEM_SESSION_OPENS = "Sessão abre";
const ITEM_SIGN_UP = "Inscrição pública com a sessão aberta, ou vaga da reserva";
const ITEM_REGISTERS = "Agendador lança paciente regulado com a sessão aberta";
const ITEM_DESK = "Recepção inclui no balcão";
const ENTRY_DESK = "Recepção inclui no balcão";
const ITEM_REMOVE = "Agendador remove lançamento";

/** Id do item da fila de uma entrada na sessão: um por entrada e sessão, determinístico. */
export const itemIdFor = (entryId: string, sessionId: string): string => `${sessionId}/${entryId}`;

/** RN-FILA-04: prefixo do serviço e número com 3 dígitos (ex.: "C-012"). */
export const ticketOf = (prefix: string, number: number): string => `${prefix}-${String(number).padStart(3, "0")}`;

// Os auxiliares exportados abaixo (hasSlot, take, free, createdItem, withOpening, situation, byQueue,
// alreadyInSession) são de uso interno do pacote (closing.ts); não saem pelo index.

/** INV-02: a sessão ainda tem vaga (`null` = sem limite). "Na reserva" não ocupa. */
export const hasSlot = (s: SessionSlots): boolean => s.slots === null || s.taken < s.slots;

export const take = (s: SessionSlots): SessionSlots => ({ ...s, taken: s.taken + 1 });
export const free = (s: SessionSlots): SessionSlots => ({ ...s, taken: Math.max(0, s.taken - 1) });

/** Estado do item na linha de criação ("—") do contrato da fila do dia. */
export function createdItem(event: string): ItemState {
  const rows = ITEM_TRANSITIONS.filter((t) => t.de === "—" && t.event === event);
  const [row] = rows;
  if (!row || rows.length > 1 || row.for === "(mesmo)" || row.for === "(não cria)") {
    throw new Error(`contrato: sem linha única de criação de item para "${event}"`);
  }
  return row.for;
}

/** Destino de linha com condição; o contrato garante que existe. */
function destination(
  de: EntryState | "—",
  event: string,
  filter: Parameters<typeof destinationByCondition>[2],
): EntryState {
  const to = destinationByCondition(de, event, filter);
  if (to === null || to === "(mesmo)") throw new Error(`contrato: "${event}" sem estado de destino`);
  return to;
}

/** "Confirmada (ou Na fila, se a sessão já abriu)": a qualificação da célula "Para" das specs. */
export const withOpening = (to: EntryState, open: boolean): EntryState =>
  to === "confirmed" && open ? "in_queue" : to;

export type Situation = { ok: true; open: boolean } | { ok: false; error: ErrorCode };

/**
 * RN-EST-07: a triagem fechou (a última estação dela) e o atendimento segue: a sessão não aceita gente nova,
 * porque ninguém faria a triagem dela. Reabrir a triagem volta a aceitar.
 */
export function triageClosed(day: SessionDay): boolean {
  if (day.state !== "open" || !day.requiresTriage) return false;
  const triage = day.stations.filter((e) => e.stage === "triage" && e.services.includes(day.serviceId));
  return triage.length > 0 && !triage.some((e) => e.open);
}

/**
 * O dia da sessão, se houver: `null` ou planejada = ainda não abriu; encerrada ou cancelada = fechada; aberta com
 * a triagem fechada não aceita gente nova (`triage_closed`).
 */
export function situation(day: SessionDay | null, session: SessionSlots): Situation {
  if (day === null) return { ok: true, open: false };
  if (day.sessionId !== session.id) return { ok: false, error: "forbidden_transition" };
  if (day.state === "planned") return { ok: true, open: false };
  if (triageClosed(day)) return { ok: false, error: "triage_closed" };
  if (day.state === "open") return { ok: true, open: true };
  return { ok: false, error: "session_closed" };
}

/**
 * Põe a entrada na fila do dia com o próximo número livre (RN-FILA-02) e a senha dele (RN-FILA-04).
 * Quem entra presente (balcão) fica elegível na hora, com a janela protegida e sem atraso (número novo).
 * O item nasce remoto "desde agora" (`leftAt = agora`): para a regra de atraso e para a falta no
 * encerramento só conta um "venha agora" recebido depois de a pessoa entrar na fila (AD-076, RN-SES-02).
 */
export function byQueue(
  day: SessionDay,
  entry: Entry,
  state: ItemState,
  now: number,
): { day: SessionDay; events: Event[] } {
  const number = day.nextNumber;
  const item: QueueItem = {
    id: itemIdFor(entry.id, day.sessionId),
    entryId: entry.id,
    ticket: ticketOf(day.ticketPrefix, number),
    number,
    stage: day.requiresTriage ? "triage" : "care",
    state,
    pendingChecks: [],
    confirmedUrgency: isUrgent(entry.confirmedRisk),
    risk: currentRisk(entry),
    // AD-027/AD-024: idade no dia desta sessão, mais a conferência guardada na entrada.
    priority: entryPriority(entry, now, day.config.timeZone),
    skips: 0,
    lockedBehind: [],
    leftAt: now,
    presentSince: state === "present" ? now : null,
    attendedInStages: [],
    exitReason: null,
  };
  // INV-05: o número vem de um contador da sessão, então a senha não se repete.
  if (day.items.some((i) => i.entryId === entry.id || i.id === item.id || i.ticket === item.ticket)) {
    throw new Error(`INV-05: entrada ${entry.id} ou senha ${item.ticket} já está na sessão ${day.sessionId}`);
  }
  const fresh: SessionDay = { ...day, items: [...day.items, item], nextNumber: number + 1 };
  const events: Event[] = [
    {
      kind: "ticket_issued",
      itemId: item.id,
      entryId: entry.id,
      sessionId: day.sessionId,
      data: { ticket: item.ticket, number },
    },
  ];
  if (state !== "present") return { day: fresh, events };
  const eligible = stayEligible(fresh, item.id, now, { applyDelay: false });
  return { day: eligible.state, events: [...events, ...eligible.events] };
}

/** INV-05: a entrada (ou o id dela) já tem item no dia da sessão; ações públicas recusam como duplicada. */
export function alreadyInSession(day: SessionDay | null, entryId: string): boolean {
  if (day === null) return false;
  const itemId = itemIdFor(entryId, day.sessionId);
  return day.items.some((i) => i.entryId === entryId || i.id === itemId);
}

const swap = (entries: Entry[], fresh: Entry): Entry[] => entries.map((e) => (e.id === fresh.id ? fresh : e));

const byDate = (a: Entry, b: Entry): number =>
  a.originalEntryDate - b.originalEntryDate || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * RN-FILA-01: a sessão abre e as confirmadas dela entram remotas, numeradas pela data de entrada
 * original (alocadas) — na inscrição pública ela é a hora da inscrição. Liberar alocações
 * pendentes e vagas seguras fica com `openSession`.
 */
export function open(day: SessionDay, entries: Entry[], now: number): Result<{ day: SessionDay; entries: Entry[] }> {
  if (applyTransition(SESSION_TRANSITIONS, day.state, SESSION_OPENS) !== "open") return failure("forbidden_transition");
  const itemState = createdItem(ITEM_SESSION_OPENS);
  let nextDay: SessionDay = { ...day, state: "open" };
  let nextEntries = entries;
  const events: Event[] = [];
  const confirmed = entries.filter((e) => e.sessionId === day.sessionId && e.state === "confirmed").sort(byDate);
  for (const e of confirmed) {
    const to = applyTransition(ENTRY_TRANSITIONS, e.state, ENTRY_SESSION_OPENS);
    if (to !== "in_queue") throw new Error(`contrato: confirmada não entra na fila na abertura (${to})`);
    const updated: Entry = { ...e, state: to };
    const r = byQueue(nextDay, updated, itemState, now);
    nextDay = r.day;
    nextEntries = swap(nextEntries, updated);
    // A senha que nasce na abertura vira o aviso "a fila de hoje abriu" (tv-e-avisos).
    events.push(
      ...r.events.map((ev) => (ev.kind === "ticket_issued" ? { ...ev, data: { ...ev.data, onOpening: true } } : ev)),
    );
  }
  return ok({ day: nextDay, entries: nextEntries }, events);
}

/** RN-ENC-04: na abertura, vaga segura sem aceite é liberada e a entrada segue aguardando encaminhamento. */
export function safeSlotsInOpening(
  entries: Entry[],
  session: SessionSlots,
): Result<{ entries: Entry[]; session: SessionSlots }> {
  let s = session;
  const events: Event[] = [];
  const fresh = entries.map((e) => {
    if (e.state !== "awaiting_referral" || e.sessionId !== session.id) return e;
    const to = destination(e.state, ENTRY_WITHOUT_ACCEPTANCE, (t) => t.qualifier === "vaga segura");
    s = free(s);
    events.push({
      kind: "slot_released",
      entryId: e.id,
      sessionId: session.id,
      reason: "sessão abriu sem a requisição aceita",
    });
    return { ...e, state: to, sessionId: null };
  });
  return ok({ entries: fresh, session: s }, events);
}

/** Serviço da sessão e as fotos de requisição já aceitas (ids de entrada). */
export type CmdReserve = { service: Service; acceptedPhotos: string[] };

/**
 * A sessão abre por inteiro (tabela de Sessão): alocações pendentes (RN-CONF-04) e vagas seguras
 * sem aceite (RN-ENC-04) são liberadas, as confirmadas entram na fila (RN-FILA-01) e as vagas
 * que abriram vão para a reserva (RN-PUB-02), já com a sessão aberta.
 */
export function openSession(
  day: SessionDay,
  session: SessionSlots,
  entries: Entry[],
  cmd: CmdReserve,
  now: number,
): Result<{ day: SessionDay; session: SessionSlots; entries: Entry[] }> {
  if (day.sessionId !== session.id) return failure("forbidden_transition");
  const pending = pendingAtOpening(entries, session);
  if (!pending.ok) return pending;
  const safe = safeSlotsInOpening(pending.state.entries, pending.state.session);
  if (!safe.ok) return safe;
  const opened = open(day, safe.state.entries, now);
  if (!opened.ok) return opened;
  const reserve = fillFromReserve(safe.state.session, opened.state.day, opened.state.entries, cmd, now);
  if (!reserve.ok) return reserve;
  return ok(
    { day: reserve.state.day ?? opened.state.day, session: reserve.state.session, entries: reserve.state.entries },
    [...pending.events, ...safe.events, ...opened.events, ...reserve.events],
  );
}

/** Ordem da reserva (RN-PUB-02): remanejados de sessão pública no topo (RN-REM-05), depois por inscrição. */
const reserveOrder = (a: Entry, b: Entry): number =>
  Number(a.reassigned === null) - Number(b.reassigned === null) || byDate(a, b);

type Slots = { session: SessionSlots; day: SessionDay | null; entries: Entry[] };

/**
 * RN-PUB-02: enquanto houver vaga livre, ela vai ao primeiro da reserva, que entra confirmado
 * (na fila, se a sessão já abriu). Sem a foto aceita: antes da abertura, recebe vaga segura
 * (RN-ENC-04); com a sessão aberta, a vaga passa ao próximo. Sessão privada não tem reserva.
 * Regra única (RN-CANC-02): toda saída que libera vaga devolve `Exit` com a sessão já liberada;
 * depois de qualquer saída, chame esta função com essa sessão (ela não libera nada).
 */
export function fillFromReserve(
  session: SessionSlots,
  day: SessionDay | null,
  entries: Entry[],
  cmd: CmdReserve,
  now: number,
): Result<Slots> {
  if (cmd.service.id !== session.serviceId) return failure("forbidden_transition");
  const sit = situation(day, session);
  // Com a triagem fechada, a reserva espera (a vaga continua livre).
  if (!sit.ok && sit.error === "triage_closed") return ok({ session, day, entries });
  if (!sit.ok) return failure(sit.error);
  if (session.visibility !== "public") return ok({ session, day, entries });

  const requiresPhoto = cmd.service.mode === "referral";
  let state: Slots = { session, day, entries };
  const events: Event[] = [];
  const reserve = entries.filter((e) => e.state === "in_reserve" && e.sessionId === session.id).sort(reserveOrder);
  for (const e of reserve) {
    if (!hasSlot(state.session)) break;
    const photoOk = !requiresPhoto || cmd.acceptedPhotos.includes(e.id);
    if (!photoOk && sit.open) continue;
    const to = withOpening(
      destination(e.state, ENTRY_FROM_RESERVE, (t) =>
        photoOk ? t.condition.startsWith("Foto aceita") : t.condition.startsWith("Requisição sem foto aceita"),
      ),
      sit.open,
    );
    const fresh: Entry = { ...e, state: to };
    let newDay = state.day;
    const ev: Event[] = [];
    if (to === "in_queue" && newDay !== null) {
      const r = byQueue(newDay, fresh, createdItem(ITEM_SIGN_UP), now);
      newDay = r.day;
      ev.push(...r.events);
    }
    state = { session: take(state.session), day: newDay, entries: swap(state.entries, fresh) };
    events.push(
      { kind: "signed_up", entryId: e.id, sessionId: session.id, reason: "vaga da reserva", data: { state: to } },
      ...ev,
    );
  }
  return ok(state, events);
}

/** Dados de quem se inscreve (RN-LE-05: a pessoa atendida), como em `createEntry`. */
type CmdNewEntry = {
  service: Service;
  person: Person;
  answers: Answers;
  id: string;
  /** Entradas ativas para a regra de uma por serviço (INV-01). */
  activeEntries: Entry[];
};

/**
 * RN-PUB-01/02, RN-ENC-04: inscrição numa sessão pública, sem agendador. Com vaga, confirmada
 * (na fila com o próximo número, se a sessão já abriu); em serviço com requisição sem foto
 * aceita, vaga segura (só antes da abertura); lotada, na reserva (não ocupa vaga).
 * Emergência, duplicada e regulado são recusados como em `createEntry`.
 */
export function signUpPublic(
  session: SessionSlots,
  day: SessionDay | null,
  cmd: CmdNewEntry & { guardianId: string | null; acceptedPhoto: boolean },
  now: number,
  config: UnitConfig = day?.config ?? DEFAULT_CONFIG,
): Result<{ entry: Entry; session: SessionSlots; day: SessionDay | null }> {
  const { service } = cmd;
  if (session.visibility !== "public" || service.id !== session.serviceId) return failure("forbidden_transition");
  const sit = situation(day, session);
  if (!sit.ok) return failure(sit.error);
  if (alreadyInSession(day, cmd.id)) return failure("duplicate");
  const created = createEntry(
    cmd.activeEntries,
    { service, person: cmd.person, guardianId: cmd.guardianId, answers: cmd.answers, id: cmd.id },
    now,
    config,
  );
  if (!created.ok) return failure(created.error);

  const photoOk = service.mode !== "referral" || cmd.acceptedPhoto;
  let condition: string;
  if (!hasSlot(session)) condition = "Sessão lotada";
  else if (photoOk) condition = "sem requisição";
  else if (sit.open) return failure("referral_pending");
  else condition = "com requisição";
  const to = withOpening(
    destination("—", ENTRY_SIGN_UP, (t) => t.condition.includes(condition)),
    sit.open,
  );

  const entry: Entry = { ...created.state, state: to, sessionId: session.id };
  const events: Event[] = created.events.filter((e) => e.kind !== "entry_created");
  events.push({
    kind: to === "in_reserve" ? "in_reserve" : "signed_up",
    entryId: entry.id,
    sessionId: session.id,
    data: { state: to },
  });
  let newDay = day;
  if (to === "in_queue" && day !== null) {
    const r = byQueue(day, entry, createdItem(ITEM_SIGN_UP), now);
    newDay = r.day;
    events.push(...r.events);
  }
  return ok({ entry, session: to === "in_reserve" ? session : take(session), day: newDay }, events);
}

/**
 * RN-PUB-02, AD-047: quem está na reserva troca por uma vaga em outra sessão pública do mesmo
 * serviço; a reserva é cancelada (a entrada é a mesma, com a data original). Sem foto aceita em
 * serviço com requisição, recebe vaga segura, só antes da abertura.
 */
export function switchReserve(
  entry: Entry,
  sessionDestination: SessionSlots,
  destinationDay: SessionDay | null,
  cmd: { service: Service; acceptedPhoto: boolean },
  now: number,
): Result<{ entry: Entry; session: SessionSlots; day: SessionDay | null }> {
  const reserveId = entry.sessionId;
  if (entry.state !== "in_reserve" || reserveId === null || reserveId === sessionDestination.id) {
    return failure("forbidden_transition");
  }
  if (
    sessionDestination.visibility !== "public" ||
    sessionDestination.serviceId !== entry.serviceId ||
    cmd.service.id !== entry.serviceId
  ) {
    return failure("forbidden_transition");
  }
  const sit = situation(destinationDay, sessionDestination);
  if (!sit.ok) return failure(sit.error);
  if (alreadyInSession(destinationDay, entry.id)) return failure("duplicate");
  if (!hasSlot(sessionDestination)) return failure("no_slot");

  const photoOk = cmd.service.mode !== "referral" || cmd.acceptedPhoto;
  if (!photoOk && sit.open) return failure("referral_pending");
  const contract = applyTransition(ENTRY_TRANSITIONS, entry.state, photoOk ? ENTRY_SWAP : ENTRY_SAFE_SWAP);
  if (contract !== "confirmed" && contract !== "awaiting_referral") return failure("forbidden_transition");
  const to = withOpening(contract, sit.open);

  const fresh: Entry = { ...entry, state: to, sessionId: sessionDestination.id };
  const events: Event[] = [
    { kind: "cancelled", entryId: entry.id, sessionId: reserveId, reason: "reserva trocada por vaga" },
    { kind: "signed_up", entryId: entry.id, sessionId: sessionDestination.id, data: { state: to } },
  ];
  let newDay = destinationDay;
  if (to === "in_queue" && destinationDay !== null) {
    const r = byQueue(destinationDay, fresh, createdItem(ITEM_SIGN_UP), now);
    newDay = r.day;
    events.push(...r.events);
  }
  return ok({ entry: fresh, session: take(sessionDestination), day: newDay }, events);
}

/**
 * RN-ENC-02/04: o agendador aceita a foto da requisição. Na lista, a entrada passa a aguardar;
 * com vaga segura, vira confirmada, só antes da abertura (`dia` = o da sessão da vaga, se houver).
 */
export function acceptReferral(entry: Entry, day: SessionDay | null, now: number): Result<Entry> {
  if (entry.state !== "awaiting_referral") return failure("forbidden_transition");
  const safe = entry.sessionId !== null;
  if (safe && day !== null) {
    if (day.sessionId !== entry.sessionId) return failure("forbidden_transition");
    if (day.state !== "planned") return failure("past_deadline");
  }
  const to = destination(entry.state, ENTRY_ACCEPTED, (t) =>
    safe ? t.qualifier === "vaga segura" : t.qualifier === undefined,
  );
  const events: Event[] = [{ kind: "referral_accepted", entryId: entry.id, data: { at: now } }];
  if (to === "confirmed" && entry.sessionId !== null) {
    events.push({ kind: "confirmed", entryId: entry.id, sessionId: entry.sessionId });
  }
  return ok({ ...entry, state: to }, events);
}

/**
 * RN-FILA-03, RN-AL-06, RN-ENC-05: a recepção inclui no balcão, com a sessão aberta e vaga livre,
 * quem não está na fila; a pessoa (local, sem conta, salvo `guardianId`) entra presente com o
 * próximo número. A recepção conferiu na hora, então a prioridade declarada já vem conferida.
 * Regulado, emergência e duplicada são recusados como em `createEntry`.
 */
export function includeAtDesk(
  day: SessionDay,
  cmd: CmdNewEntry & { session: SessionSlots; guardianId?: string | null },
  now: number,
): Result<{ day: SessionDay; session: SessionSlots; entry: Entry }> {
  const { service, session } = cmd;
  if (session.id !== day.sessionId || service.id !== session.serviceId || service.id !== day.serviceId) {
    return failure("forbidden_transition");
  }
  if (service.mode === "regulated") return failure("regulated_service");
  if (day.state !== "open") return failure("session_closed");
  if (triageClosed(day)) return failure("triage_closed");
  if (alreadyInSession(day, cmd.id)) return failure("duplicate");
  const created = createEntry(
    cmd.activeEntries,
    {
      service,
      person: cmd.person,
      guardianId: cmd.guardianId ?? null,
      answers: cmd.answers,
      id: cmd.id,
    },
    now,
    day.config,
  );
  if (!created.ok) return failure(created.error);
  if (!hasSlot(session)) return failure("no_slot");
  const to = destinationByCondition("—", ENTRY_DESK, () => true);
  if (to !== "in_queue") return failure("forbidden_transition");

  const base = created.state;
  const entry: Entry = {
    ...base,
    state: to,
    sessionId: session.id,
    priority: hasPriority(entryPriority(base, now, day.config.timeZone))
      ? { ...base.priority, verified: true, verifiedAt: now }
      : base.priority,
  };
  const r = byQueue(day, entry, createdItem(ITEM_DESK), now);
  const events: Event[] = [
    ...created.events.filter((e) => e.kind !== "entry_created"),
    { kind: "signed_up", entryId: entry.id, sessionId: session.id, reason: "balcão", data: { state: to } },
    ...r.events,
  ];
  return ok({ day: r.day, session: take(session), entry }, events);
}

/**
 * RN-ENC-06, AD-036/037/049: o agendador lança pelo CPF quem a regulação mandou, em sessão
 * privada com vaga. Entra confirmado, sem prazo de confirmação nem liberação na abertura; com a
 * sessão aberta, direto na fila remota. O risco da regulação (padrão rotina) vale como confirmado.
 * A conta só é ligada se verificada; senão, é pessoa sem app (sem push).
 */
export function registerRegulated(
  session: SessionSlots,
  day: SessionDay | null,
  cmd: {
    service: Service;
    id: string;
    person: Person;
    accountId: string | null;
    verifiedAccount: boolean;
    regulationRisk?: RiskLevel;
    activeEntries: Entry[];
  },
  now: number,
): Result<{ entry: Entry; session: SessionSlots; day: SessionDay | null }> {
  const { service } = cmd;
  if (service.mode !== "regulated" || service.id !== session.serviceId || session.visibility !== "private") {
    return failure("forbidden_transition");
  }
  const sit = situation(day, session);
  if (!sit.ok) return failure(sit.error);
  // A escala de risco (lista-espera, "Classificação de risco"): emergência não entra em lista nem fila;
  // vai ao SAMU (192), como no questionário (RN-LE-01, linha "Questionário = Emergência").
  if (cmd.regulationRisk === "emergency") return failure("emergency");
  if (alreadyInSession(day, cmd.id)) return failure("duplicate");
  if (activeEntryOf(cmd.activeEntries, cmd.person, service.id)) return failure("duplicate");
  if (!hasSlot(session)) return failure("no_slot");

  const to = destination("—", ENTRY_REGISTERS, (t) =>
    t.condition.includes(sit.open ? "sessão aberta" : "sessão privada planejada"),
  );
  const risk = cmd.regulationRisk ?? "routine";
  const guardianId = cmd.verifiedAccount ? cmd.accountId : null;
  const entry: Entry = {
    id: cmd.id,
    serviceId: service.id,
    guardianId,
    person: { ...cmd.person },
    state: to,
    originalEntryDate: now,
    classification: { level: risk, rule: "Classificação informada pela regulação", support: false },
    confirmedRisk: risk,
    // Nada declarado; idoso entra pela data de nascimento no dia da sessão (AD-027).
    priority: { groups: [], verified: false, verifiedAt: null },
    reassigned: null,
    refusals: 0,
    sessionId: session.id,
    allocatedAt: null,
    askedAt: null,
    answeredAt: null,
    archivedAt: null,
    refusedSessions: [],
  };
  const events: Event[] = [
    { kind: "registered", entryId: entry.id, sessionId: session.id, data: { push: guardianId !== null } },
  ];
  let newDay = day;
  if (to === "in_queue" && day !== null) {
    const r = byQueue(day, entry, createdItem(ITEM_REGISTERS), now);
    newDay = r.day;
    events.push(...r.events);
  }
  return ok({ entry, session: take(session), day: newDay }, events);
}

/**
 * RN-ENC-06, AD-037: o agendador remove, com motivo, um lançamento nunca chamado no dia. A vaga é
 * liberada sem sugestão (não há lista; `Exit` com a sessão já liberada); push só para conta
 * verificada (ligada).
 */
export function removeRegulatedEntry(
  entry: Entry,
  session: SessionSlots,
  day: SessionDay | null,
  cmd: { service: Service; reason: string },
  now: number,
): Result<Exit> {
  const { service } = cmd;
  if (service.mode !== "regulated" || entry.serviceId !== service.id || entry.sessionId !== session.id) {
    return failure("forbidden_transition");
  }
  const to = applyTransition(ENTRY_TRANSITIONS, entry.state, ENTRY_REMOVE);
  if (to !== "cancelled") return failure("forbidden_transition");

  let newDay = day;
  if (entry.state === "in_queue") {
    if (day === null || day.sessionId !== session.id) return failure("forbidden_transition");
    const item = day.items.find((i) => i.entryId === entry.id);
    if (!item || day.calls.some((c) => c.itemId === item.id)) return failure("forbidden_transition");
    if (applyTransition(ITEM_TRANSITIONS, item.state, ITEM_REMOVE) !== "left_queue")
      return failure("forbidden_transition");
    newDay = {
      ...day,
      items: day.items.map((i) =>
        i.id === item.id
          ? { ...i, state: "left_queue" as const, lockedBehind: [], exitReason: "removed" as const }
          : { ...i, lockedBehind: i.lockedBehind.filter((t) => t !== item.id) },
      ),
    };
  }
  const ids = { entryId: entry.id, sessionId: session.id };
  return ok({ entry: { ...entry, state: to }, session: free(session), day: newDay }, [
    { kind: "removed", ...ids, reason: cmd.reason, data: { push: entry.guardianId !== null } },
    { kind: "slot_released", ...ids, reason: "lançamento removido; sem sugestão", data: { at: now } },
  ]);
}

const WAIT_CLOSED: EntryState[] = ["cancelled", "completed", "closed_without_care", "archived"];

/**
 * RN-RISCO-03: o paciente refaz o questionário enquanto espera; o nível sugerido muda (RN-RISCO-01).
 * Subir para urgente alerta o agendador; emergência é recusada (o app orienta ligar 192) e nada
 * muda. Na fila do dia (`dia` = o da sessão da entrada, aberta), o item remoto passa a usar o
 * risco vigente (o confirmado, se houver, continua valendo); presente segue no lugar até a
 * triagem. DECISÃO: grupos da Tela 5 não mudam aqui (prioridade nova só vale depois de conferida).
 */
export function redoQuestionnaire(
  entry: Entry,
  day: SessionDay | null,
  cmd: { answers: Answers },
  now: number,
  config: UnitConfig = day?.config ?? DEFAULT_CONFIG,
): Result<{ entry: Entry; day: SessionDay | null }> {
  if (WAIT_CLOSED.includes(entry.state)) return failure("forbidden_transition");
  if (day !== null && day.sessionId !== entry.sessionId) return failure("forbidden_transition");
  const classification = classify(cmd.answers, ageAt(entry.person.birthDate, now, config.timeZone));
  if (classification.level === "emergency") return failure("emergency");
  const fresh: Entry = { ...entry, classification };
  const events: Event[] = [];
  if (classification.level === "urgent" && entry.classification.level !== "urgent") {
    events.push({ kind: "scheduler_alert", entryId: entry.id, reason: classification.rule });
  }
  const item = day?.state === "open" ? day.items.find((i) => i.entryId === entry.id) : undefined;
  const risk = currentRisk(fresh);
  if (day === null || item?.state !== "remote" || item.risk === risk) return ok({ entry: fresh, day }, events);
  events.push({
    kind: "risk_suggested",
    itemId: item.id,
    entryId: entry.id,
    sessionId: day.sessionId,
    data: { level: risk },
  });
  const newDay: SessionDay = { ...day, items: day.items.map((i) => (i.id === item.id ? { ...i, risk } : i)) };
  return ok({ entry: fresh, day: newDay }, events);
}
