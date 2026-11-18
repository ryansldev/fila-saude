import {
  applyTransition,
  ENTRY_TRANSITIONS,
  type EntryState,
  ITEM_TRANSITIONS,
  type ItemState,
  SESSION_TRANSITIONS,
  type Transition,
} from "./contracts.ts";
import { type Entry, type Exit, type Origin, otherDateInSession, type Service, type SessionSlots } from "./list.ts";
import { callsThatSkipTurn, type ExitReason, inContingency, type QueueItem, type SessionDay } from "./queue.ts";
import { type Event, failure, ok, type Result } from "./result.ts";
import { alreadyInSession, byQueue, createdItem, free, hasSlot, situation, take, withOpening } from "./session.ts";
import { sameDay } from "./time.ts";

export type { Origin } from "./list.ts";

// Eventos das tabelas de transição (textos copiados das specs).
const SESSION_CLOSES = "Encerra";
const SESSION_CANCELS = "Cancela";
const ITEM_CLOSED = "Sessão encerrada";
const ITEM_CANCELLED = "Sessão cancelada";
const ITEM_PATIENT_CANCELS = "Paciente cancela";
const ITEM_SIGN_UP = "Inscrição pública com a sessão aberta, ou vaga da reserva";
const ENTRY_BEFORE_TURN = "Sessão cancelada, ou encerrada antes da vez";
const ENTRY_CLOSED_WITHOUT_NO_SHOW =
  "Sessão encerrada com o paciente presente, já atendido em etapa anterior ou com a vez passada em contingência";
const ENTRY_NO_SHOW = "3º pulo, ou falta no encerramento";
const ENTRY_RESERVE_CLOSES = "Sessão encerrada ou cancelada sem vaga para ele";
const ENTRY_NO_SHOW_VOIDED =
  "Período de contingência registrado depois do encerramento, no mesmo dia, cobrindo a vez dele";
const ENTRY_GIVE_UP = '"Desistir"';
const ENTRY_PATIENT_CANCELS = "Paciente cancela";
const ENTRY_WONT_GO = 'Paciente cancela ("Não vou poder ir")';
const ENTRY_UNBOOKS_REGULATED = "Paciente desmarca ou desiste";
const ENTRY_COMPLETED = "Atendida na última etapa";
const ENTRY_NOT_VERIFIED = "Recepção: identidade não confere (RN-FILA-05)";
const ENTRY_CHOOSES = "Escolhe ocorrência pública do serviço";
const ENTRY_CHOOSES_FULL = "Escolhe ocorrência pública lotada";
const ENTRY_CHOOSES_SAFE = "Escolhe ocorrência com vaga, sem foto aceita em serviço com requisição";

/** Destino da única linha (de, evento) que passa no filtro; `null` sem linha única (transição proibida). */
function singleRow<S extends string>(
  table: Transition<S>[],
  de: S,
  event: string,
  filter: (t: Transition<S>) => boolean = () => true,
): S | null {
  const rows = table.filter((t) => t.de === de && t.event === event && filter(t));
  const [row] = rows;
  if (!row || rows.length > 1 || row.for === "(mesmo)" || row.for === "(não cria)") return null;
  return row.for;
}

/** Destino que o contrato garante (erro de programação se faltar a linha). */
function guaranteed<S extends string>(
  table: Transition<S>[],
  de: S,
  event: string,
  filter?: (t: Transition<S>) => boolean,
): S {
  const to = singleRow(table, de, event, filter);
  if (to === null) throw new Error(`contrato: sem linha única para "${de}" com "${event}"`);
  return to;
}

/** RN-REM-03: a origem do remanejado vem do serviço (regulado) e da visibilidade da sessão. */
export function sessionOrigin(session: SessionSlots, service: Service): Origin {
  if (service.mode === "regulated") return "regulated";
  return session.visibility === "public" ? "public" : "private";
}

/**
 * RN-REM-04: remanejada mantém risco, prioridade e data original; perde a sessão. DECISÃO: um
 * novo prejuízo pela unidade dá a origem desta sessão e zera as recusas (preferência renovada).
 */
const reassign = (e: Entry, state: EntryState, origin: Origin): Entry => ({
  ...e,
  state,
  reassigned: origin,
  refusals: 0,
  sessionId: null,
  allocatedAt: null,
});

const ITEM_FINAL: ItemState[] = ["done_in_stage", "left_queue", "reassigned"];

/** Item ainda na fila (não final). */
const inQueue = (i: QueueItem): boolean => !ITEM_FINAL.includes(i.state);

type Outcome = "reassigned" | "no_show";

/**
 * RN-SES-02, RN-FALTA-01, AD-041, RN-CONT-03: desfecho de quem está na fila ao encerrar e a
 * linha do contrato do item. Presente nunca leva falta; remoto com a vez passada (na etapa
 * atual, enquanto estava fora) leva, exceto se já foi atendido numa etapa do dia ou se todas as
 * chamadas que passaram a vez dele foram feitas em contingência registrada.
 */
function outcomeInClosing(day: SessionDay, x: QueueItem): { outcome: Outcome; condition: string } {
  const passed = callsThatSkipTurn(day, x);
  if (passed.length === 0) return { outcome: "reassigned", condition: "A vez não passou" };
  if (x.state === "present") return { outcome: "reassigned", condition: "A vez passou" };
  if (x.attendedInStages.length > 0) return { outcome: "reassigned", condition: "Já atendido em etapa anterior" };
  if (passed.every((c) => inContingency(day, c.at))) {
    return { outcome: "reassigned", condition: "A vez passou durante período de contingência registrado" };
  }
  return { outcome: "no_show", condition: "A vez passou; nunca atendido no dia; fora de contingência" };
}

/** Linha do contrato da entrada para cada motivo de saída que só a fila do dia produz. */
const EVENT_BY_REASON: Partial<Record<ExitReason, string>> = {
  skips: ENTRY_NO_SHOW,
  no_show: ENTRY_NO_SHOW,
  not_verified: ENTRY_NOT_VERIFIED,
};

/**
 * Mapeamento único do desfecho do item na fila do dia para a entrada "Na fila" (contrato de
 * Entrada): atendido na última etapa → Concluída; 3º pulo (ou falta no encerramento) → Encerrada
 * sem atendimento, e a pessoa pode criar entrada nova (RN-CHAM-03); identidade não confere →
 * Cancelada (RN-FILA-05). Chame depois de `finalizar`/`chamarProximo`, `noShow` e
 * `verifyAndMark` quando o item ficar final; `encerrar` e `cancelar` aplicam a quem faltou.
 * Remanejado, cancelamento e remoção mudam a entrada na própria ação: aqui são recusados.
 */
export function entryOutcome(entry: Entry, item: QueueItem): Result<Entry> {
  if (entry.state !== "in_queue" || item.entryId !== entry.id) return failure("forbidden_transition");
  let event: string | undefined;
  // Atendido que não segue para outra etapa: o atendimento, ou a triagem que encaminhou à emergência (H2).
  if (item.state === "done_in_stage") event = ENTRY_COMPLETED;
  else if (item.state === "left_queue" && item.exitReason !== null) event = EVENT_BY_REASON[item.exitReason];
  if (event === undefined) return failure("forbidden_transition");
  const to = guaranteed(ENTRY_TRANSITIONS, entry.state, event);
  const ids = {
    entryId: entry.id,
    itemId: item.id,
    ...(entry.sessionId === null ? {} : { sessionId: entry.sessionId }),
  };
  const events: Event[] = to === "cancelled" ? [{ kind: "cancelled", ...ids, reason: "identidade não confere" }] : [];
  return ok({ ...entry, state: to }, events);
}

/** Entrada "Na fila" cujo item já é final: aplica o desfecho; sem desfecho, fica como está. */
function closeWithOutcome(e: Entry, day: SessionDay, events: Event[]): Entry {
  const item = day.items.find((i) => i.entryId === e.id);
  if (e.state !== "in_queue" || item === undefined) return e;
  const r = entryOutcome(e, item);
  if (!r.ok) return e;
  events.push(...r.events);
  return r.state;
}

type DayAndEntries = { day: SessionDay; entries: Entry[] };

/**
 * RN-SES-01..04: o admin encerra a sessão aberta, sem estação com paciente chamado. Cada um ainda
 * na fila vira remanejado ou leva falta (RN-SES-02); a reserva é cancelada. Entrada ainda "Na
 * fila" cujo item já teve desfecho no dia é fechada por `entryOutcome`. Sinal perdido sem
 * contingência registrada só gera o aviso (RN-SES-04). `entradas` são as da sessão; `origem`
 * vem de `sessionOrigin`.
 */
export function close(
  day: SessionDay,
  entries: Entry[],
  now: number,
  options: { withoutSignalWithoutContingency: boolean; origin: Origin },
): Result<DayAndEntries> & { notice?: "signal_lost" } {
  if (applyTransition(SESSION_TRANSITIONS, day.state, SESSION_CLOSES) !== "closed")
    return failure("forbidden_transition");
  if (day.stations.some((e) => e.calledItemId !== null) || day.items.some((i) => i.state === "called")) {
    return failure("station_has_call");
  }

  const events: Event[] = [];
  const noShows: string[] = [];
  const byEntry = new Map<string, { outcome: Outcome; condition: string }>();
  const items = day.items.map((x) => {
    if (!inQueue(x)) return x;
    const { outcome, condition } = outcomeInClosing(day, x);
    const to = guaranteed(ITEM_TRANSITIONS, x.state, ITEM_CLOSED, (t) => t.condition === condition);
    byEntry.set(x.entryId, { outcome, condition });
    const ids = { itemId: x.id, entryId: x.entryId, sessionId: day.sessionId };
    if (outcome === "no_show") {
      noShows.push(x.id);
      events.push({ kind: "no_show", ...ids, reason: "vez passou no encerramento" }, { kind: "left_queue", ...ids });
    } else {
      events.push({ kind: "reassigned", ...ids, reason: condition });
    }
    return { ...x, state: to, lockedBehind: [], exitReason: outcome === "no_show" ? ("no_show" as const) : null };
  });

  const fresh = entries.map((e) => {
    if (e.sessionId !== day.sessionId) return e;
    if (e.state === "in_reserve") {
      events.push({ kind: "cancelled", entryId: e.id, sessionId: day.sessionId, reason: "sessão encerrada" });
      return { ...e, state: guaranteed(ENTRY_TRANSITIONS, e.state, ENTRY_RESERVE_CLOSES) };
    }
    const end = byEntry.get(e.id);
    if (e.state !== "in_queue") return e;
    if (end === undefined) return closeWithOutcome(e, day, events);
    const event =
      end.outcome === "no_show"
        ? ENTRY_NO_SHOW
        : end.condition === "A vez não passou"
          ? ENTRY_BEFORE_TURN
          : ENTRY_CLOSED_WITHOUT_NO_SHOW;
    const to = guaranteed(ENTRY_TRANSITIONS, e.state, event);
    return end.outcome === "no_show" ? { ...e, state: to } : reassign(e, to, options.origin);
  });

  const closed: SessionDay = {
    ...day,
    state: "closed",
    items,
    closing: { at: now, noShows, origin: options.origin },
  };
  const r = ok<DayAndEntries>({ day: closed, entries: fresh }, events);
  return options.withoutSignalWithoutContingency ? { ...r, notice: "signal_lost" } : r;
}

/**
 * Fluxo de cancelamento de sessão (excecoes, tabela de Sessão): planejada ou aberta. Entradas não
 * finais da sessão, inclusive a chamada no momento, viram remanejadas; "Na reserva" é cancelada.
 * Cancelamento nunca gera falta; quem já teve desfecho no dia (atendido, 3º pulo, não conferiu)
 * não é remanejado: a entrada vai à linha desse desfecho (`entryOutcome`).
 */
export function cancel(
  day: SessionDay,
  entries: Entry[],
  now: number,
  options: { origin: Origin },
): Result<DayAndEntries> {
  if (applyTransition(SESSION_TRANSITIONS, day.state, SESSION_CANCELS) !== "cancelled")
    return failure("forbidden_transition");
  const events: Event[] = [];
  const items = day.items.map((x) => {
    if (!inQueue(x)) return x;
    return { ...x, state: guaranteed(ITEM_TRANSITIONS, x.state, ITEM_CANCELLED), lockedBehind: [] };
  });
  const reassignable: EntryState[] = ["allocated", "confirmed", "awaiting_referral", "in_queue"];
  const fresh = entries.map((e) => {
    if (e.sessionId !== day.sessionId) return e;
    const ids = { entryId: e.id, sessionId: day.sessionId };
    if (e.state === "in_reserve") {
      events.push({ kind: "cancelled", ...ids, reason: "sessão cancelada" });
      return { ...e, state: guaranteed(ENTRY_TRANSITIONS, e.state, ENTRY_RESERVE_CLOSES) };
    }
    if (!reassignable.includes(e.state)) return e;
    const item = day.items.find((i) => i.entryId === e.id);
    if (item !== undefined && !inQueue(item)) return closeWithOutcome(e, day, events);
    const to = guaranteed(ENTRY_TRANSITIONS, e.state, ENTRY_BEFORE_TURN);
    events.push({ kind: "reassigned", ...ids, ...(item ? { itemId: item.id } : {}), reason: "sessão cancelada" });
    return reassign(e, to, options.origin);
  });
  const cancelled: SessionDay = {
    ...day,
    state: "cancelled",
    items,
    stations: day.stations.map((s) => (s.calledItemId === null ? s : { ...s, calledItemId: null })),
  };
  return ok({ day: cancelled, entries: fresh }, [
    ...events,
    { kind: "cancelled", sessionId: day.sessionId, data: { at: now } },
  ]);
}

/**
 * RN-CONT-02/03: a recepção registra um período de contingência já terminado. Na sessão aberta,
 * o período passa a valer na regra de atraso e no encerramento. Na sessão encerrada, se o registro
 * é no mesmo dia do encerramento (fuso da unidade), as faltas do encerramento cuja vez passou só
 * dentro de contingência são apagadas e viram remanejadas (única reversão de estado final).
 */
export function registerContingency(
  day: SessionDay,
  entries: Entry[],
  period: { start: number; end: number; reason: string },
  now: number,
): Result<DayAndEntries> {
  if (day.state === "planned") return failure("forbidden_transition");
  // DECISÃO: período só depois de terminado (fim ≤ agora), registrado "na volta" (RN-CONT-02).
  if (!(period.start < period.end) || period.end > now) return failure("forbidden_transition");
  const withPeriod: SessionDay = { ...day, contingencies: [...day.contingencies, { ...period }] };
  const ref = day.closing;
  if (day.state !== "closed" || ref === undefined || !sameDay(now, ref.at, day.config.timeZone)) {
    return ok({ day: withPeriod, entries });
  }

  const events: Event[] = [];
  // Só apaga a falta com a entrada dela em mãos, encerrada sem atendimento por falta nesta sessão.
  const dimmed = new Map<string, Entry>();
  for (const itemId of ref.noShows) {
    const x = day.items.find((i) => i.id === itemId);
    const e = x && entries.find((en) => en.id === x.entryId && en.sessionId === day.sessionId);
    if (!x || !e) continue;
    const to = singleRow(ENTRY_TRANSITIONS, e.state, ENTRY_NO_SHOW_VOIDED);
    if (to === null) continue;
    // Recalcula como no encerramento: o item estava remoto, nunca atendido.
    const passed = callsThatSkipTurn(withPeriod, x);
    if (passed.length === 0 || !passed.every((c) => inContingency(withPeriod, c.at))) continue;
    dimmed.set(itemId, reassign(e, to, ref.origin));
    const ids = { itemId, entryId: e.id, sessionId: day.sessionId };
    events.push(
      { kind: "no_show_voided", ...ids, reason: period.reason },
      { kind: "reassigned", ...ids, reason: "contingência registrada" },
    );
  }
  // DECISÃO: o item volta ao desfecho que o encerramento daria (remanejado), para a fila do dia
  // mostrar o mesmo que a entrada; o contrato do item não tem linha de reversão própria.
  const forItem = guaranteed(ITEM_TRANSITIONS, "remote", ITEM_CLOSED, (t) => t.spec === "contingencia");
  const items = withPeriod.items.map((i) => (dimmed.has(i.id) ? { ...i, state: forItem, exitReason: null } : i));
  const newOf = new Map([...dimmed.values()].map((e) => [e.id, e]));
  const fresh = entries.map((e) => newOf.get(e.id) ?? e);
  const recalculated: SessionDay = {
    ...withPeriod,
    items,
    closing: { ...ref, noShows: ref.noShows.filter((f) => !dimmed.has(f)) },
  };
  return ok({ day: recalculated, entries: fresh }, events);
}

/**
 * RN-ID-06, AD-040: em quem fica a falta. Lançado regulado: na pessoa (CPF da regulação). Pessoa
 * conferida na unidade: nela. Senão, no responsável que marcou, se a conta dele é verificada;
 * conta não verificada ou pessoa local sem conta: em ninguém.
 */
export function noShowHolder(
  entry: Entry,
  verified: boolean,
  verifiedGuardian: boolean,
  registered: boolean,
): "person" | "guardian" | "nobody" {
  if (registered || verified) return "person";
  return entry.guardianId !== null && verifiedGuardian ? "guardian" : "nobody";
}

/**
 * Tira da fila do dia o item da entrada "Na fila" (o "Paciente cancela" do item), a partir dos
 * estados aceitos. Fora da fila, devolve o dia como veio.
 */
function leaveQueue(
  entry: Entry,
  day: SessionDay | null,
  accepted: ItemState[],
): { ok: true; day: SessionDay | null } | { ok: false } {
  if (entry.state !== "in_queue") return { ok: true, day };
  if (day === null || day.sessionId !== entry.sessionId || day.state !== "open") return { ok: false };
  const x = day.items.find((i) => i.entryId === entry.id);
  if (!x || !accepted.includes(x.state)) return { ok: false };
  if (applyTransition(ITEM_TRANSITIONS, x.state, ITEM_PATIENT_CANCELS) !== "left_queue") return { ok: false };
  return {
    ok: true,
    day: {
      ...day,
      items: day.items.map((i) =>
        i.id === x.id
          ? { ...i, state: "left_queue" as const, lockedBehind: [], exitReason: "cancelled" as const }
          : { ...i, lockedBehind: i.lockedBehind.filter((t) => t !== x.id) },
      ),
    },
  };
}

/**
 * RN-REM-03, AD-045: "Outra data" do remanejado com data na sessão `sessao` (confirmada, alocada,
 * vaga segura ou na fila ainda remoto; `dia` = o da sessão, se aberta). Só em sessão privada ou
 * regulada. 1ª vez: continua remanejado, com a preferência. 2ª (só confirmada ou alocada): privada
 * volta à lista com a data original; pública e regulada são encerradas com aviso. Devolve `Exit`
 * (sessão já liberada). É a entrada do app para qualquer remanejada com data, inclusive alocada;
 * a regra (`otherDateInSession`, lista.ts) é a mesma de `recusar`.
 */
export function otherDate(
  entry: Entry,
  session: SessionSlots,
  now: number,
  day: SessionDay | null = null,
): Result<Exit> {
  const r = otherDateInSession(entry, session, now);
  if (!r.ok) return r;
  const exit = leaveQueue(entry, day, ["remote"]);
  if (!exit.ok) return failure("forbidden_transition");
  return ok({ ...r.state, day: exit.day }, r.events);
}

/**
 * RN-REM-03: "Desistir" cancela de vez. Com data (confirmada, alocada, vaga segura ou na fila), a
 * vaga de `sessao` (a da entrada) é liberada e devolvida em `Exit`; aguardando remarcação, é o
 * cancelamento do paciente e `sessao` é `null`. Em serviço regulado, o agendador é avisado para
 * comunicar a regulação.
 */
export function giveUp(
  entry: Entry,
  session: SessionSlots | null,
  now: number,
  day: SessionDay | null = null,
): Result<Exit<SessionSlots | null>> {
  const origin = entry.reassigned;
  if (origin === null) return failure("forbidden_transition");
  const withoutDate = entry.state === "reassigned";
  if (withoutDate ? session !== null : session === null || entry.sessionId !== session.id) {
    return failure("forbidden_transition");
  }
  const to = singleRow(ENTRY_TRANSITIONS, entry.state, withoutDate ? ENTRY_PATIENT_CANCELS : ENTRY_GIVE_UP);
  if (to !== "cancelled") return failure("forbidden_transition");
  const exit = leaveQueue(entry, day, ["remote", "present"]);
  if (!exit.ok) return failure("forbidden_transition");

  const ids = { entryId: entry.id, ...(entry.sessionId === null ? {} : { sessionId: entry.sessionId }) };
  const events: Event[] = [];
  if (!withoutDate) events.push({ kind: "slot_released", ...ids });
  events.push({
    kind: "cancelled",
    ...ids,
    ...(origin === "regulated" ? { reason: "comunicar a regulação" } : {}),
    data: { gaveUp: true, at: now },
  });
  return ok(
    {
      entry: { ...entry, state: to, reassigned: null, sessionId: null, allocatedAt: null },
      session: session === null ? null : free(session),
      day: exit.day,
    },
    events,
  );
}

/** Estados em que a entrada ocupa uma vaga da sessão (INV-02); "Na reserva" não ocupa. */
const WITH_SLOT: EntryState[] = ["allocated", "confirmed", "in_queue"];

/** RN-CANC-01: a entrada ocupa vaga da sessão (inclusive a vaga segura de quem aguarda a requisição). */
export const holdsSlot = (e: Pick<Entry, "state" | "sessionId">): boolean =>
  WITH_SLOT.includes(e.state) || (e.state === "awaiting_referral" && e.sessionId !== null);

/**
 * RN-CANC-01/02/03: o paciente cancela ("Não vou poder ir") a entrada não remanejada (remanejada
 * usa `desistir`). Na lista (aguardando, aguardando encaminhamento) ou na reserva, só cancela;
 * com vaga (alocada, confirmada, vaga segura ou na fila, remoto ou presente), libera a vaga da
 * `sessao` (a da entrada) e tira o item da fila do dia, devolvendo `Exit`; depois, chame
 * `fillFromReserve`. Em serviço regulado (lançado) é "Paciente desmarca ou desiste": vaga sem
 * sugestão e o agendador avisado para comunicar a regulação. Quem cancela faz entrada nova.
 */
export function cancelEntry(
  entry: Entry,
  session: SessionSlots | null,
  day: SessionDay | null,
  cmd: { service: Service },
  now: number,
): Result<Exit<SessionSlots | null>> {
  const { service } = cmd;
  if (entry.reassigned !== null || service.id !== entry.serviceId) return failure("forbidden_transition");
  const regulated = service.mode === "regulated";
  const withSlot = holdsSlot(entry);
  if (withSlot ? session === null || entry.sessionId !== session.id : session !== null) {
    return failure("forbidden_transition");
  }
  const event = regulated
    ? ENTRY_UNBOOKS_REGULATED
    : WITH_SLOT.includes(entry.state)
      ? ENTRY_WONT_GO
      : ENTRY_PATIENT_CANCELS;
  const to = singleRow(ENTRY_TRANSITIONS, entry.state, event);
  if (to !== "cancelled") return failure("forbidden_transition");
  const exit = leaveQueue(entry, day, ["remote", "present"]);
  if (!exit.ok) return failure("forbidden_transition");

  const ids = { entryId: entry.id, ...(entry.sessionId === null ? {} : { sessionId: entry.sessionId }) };
  const events: Event[] = [];
  if (withSlot) events.push({ kind: "slot_released", ...ids, ...(regulated ? { reason: "sem sugestão" } : {}) });
  events.push({
    kind: "cancelled",
    ...ids,
    ...(regulated ? { reason: "comunicar a regulação" } : {}),
    data: { at: now },
  });
  return ok(
    {
      entry: { ...entry, state: to, sessionId: null, allocatedAt: null },
      session: session === null ? null : free(session),
      day: exit.day,
    },
    events,
  );
}

/**
 * RN-REM-05, AD-031: o remanejado de sessão pública escolhe uma ocorrência pública do serviço.
 * Com vaga: confirmado (na fila remota com o próximo número, se já abriu); sem a foto aceita em
 * serviço com requisição, vaga segura só antes da abertura. Lotada: topo da reserva, sem ocupar
 * vaga e sem tirar ninguém (INV-10). Mantém a origem, para o topo da reserva.
 */
export function chooseDate(
  entry: Entry,
  session: SessionSlots,
  day: SessionDay | null,
  cmd: { service: Service; acceptedPhoto: boolean },
  now: number,
): Result<{ entry: Entry; session: SessionSlots; day: SessionDay | null }> {
  if (entry.state !== "reassigned" || entry.reassigned !== "public") return failure("forbidden_transition");
  if (session.visibility !== "public" || session.serviceId !== entry.serviceId || cmd.service.id !== entry.serviceId) {
    return failure("forbidden_transition");
  }
  const sit = situation(day, session);
  if (!sit.ok) return failure(sit.error);
  if (alreadyInSession(day, entry.id)) return failure("duplicate");

  const ids = { entryId: entry.id, sessionId: session.id };
  if (!hasSlot(session)) {
    const to = guaranteed(ENTRY_TRANSITIONS, entry.state, ENTRY_CHOOSES_FULL);
    return ok({ entry: { ...entry, state: to, sessionId: session.id }, session, day }, [
      { kind: "in_reserve", ...ids, reason: "remanejada: topo da reserva", data: { at: now } },
    ]);
  }
  const photoOk = cmd.service.mode !== "referral" || cmd.acceptedPhoto;
  if (!photoOk && sit.open) return failure("referral_pending");
  const to = withOpening(
    guaranteed(ENTRY_TRANSITIONS, entry.state, photoOk ? ENTRY_CHOOSES : ENTRY_CHOOSES_SAFE),
    sit.open,
  );
  const fresh: Entry = { ...entry, state: to, sessionId: session.id };
  const events: Event[] = [{ kind: "signed_up", ...ids, reason: "remanejada", data: { state: to } }];
  let newDay = day;
  if (to === "in_queue" && day !== null) {
    const r = byQueue(day, fresh, createdItem(ITEM_SIGN_UP), now);
    newDay = r.day;
    events.push(...r.events);
  }
  return ok({ entry: fresh, session: take(session), day: newDay }, events);
}
