import { applyTransition, ITEM_TRANSITIONS, type ItemState } from "./contracts.ts";
import { isUrgent, type RiskLevel } from "./kinds.ts";
import { advance, inBreak, leavePause, pausedAt } from "./pause-time.ts";
import {
  eligible,
  orderKey,
  type QueueItem,
  type SessionDay,
  type Stage,
  type Station,
  stayEligible,
} from "./queue.ts";
import { type ErrorCode, type Event, failure, ok, type Result } from "./result.ts";

type Cmd = { stationId: string };

/**
 * Fechar o chamado da estação (Finalizar ou chamar o próximo). Na triagem, o profissional pode
 * confirmar ou reclassificar o risco de quem sai dela (RN-TRI-03, RN-RISCO-01); `refer`, com vermelho,
 * encaminha à emergência e tira da fila desta unidade (AD-059).
 */
type CmdClose = Cmd & {
  confirmedRisk?: RiskLevel;
  refer?: boolean;
  /** RN-PERF-05: quem opera classifica o risco (enfermeiro). Sem isso (técnico), fecha o acolhimento. */
  classifies?: boolean;
};

const MIN = 60_000;
const EVENT_CALL = "Estação chama o próximo";
const EVENT_CLOSE = "Estação chama o próximo ou toca Finalizar";
const EVENT_WELCOMED = "Técnico finaliza o acolhimento na triagem";
const EVENT_NO_SHOW = '"Não compareceu"';

const withStation = (day: SessionDay, stationId: string, partial: Partial<Station>): SessionDay => ({
  ...day,
  stations: day.stations.map((e) => (e.id === stationId ? { ...e, ...partial } : e)),
});

const withItem = (day: SessionDay, fresh: QueueItem): SessionDay => ({
  ...day,
  items: day.items.map((i) => (i.id === fresh.id ? fresh : i)),
});

/** Ninguém fica travado atrás de quem deixou a sala (chamado, foi para casa, saiu da fila). */
const releaseLocks = (day: SessionDay, itemId: string): SessionDay => ({
  ...day,
  items: day.items.map((i) =>
    i.lockedBehind.includes(itemId) ? { ...i, lockedBehind: i.lockedBehind.filter((t) => t !== itemId) } : i,
  ),
});

const base = (day: SessionDay, i: QueueItem, stationId: string) => ({
  itemId: i.id,
  entryId: i.entryId,
  stationId,
  sessionId: day.sessionId,
});

type CalledInStation =
  | { ok: true; station: Station; item: QueueItem }
  | { ok: false; error: "session_closed" | "forbidden_transition" };

/**
 * O paciente chamado nesta estação, nesta sessão. Um chamado de outra sessão (item que não está
 * aqui) não é deste dia: as ações sobre ele recusam em vez de derrubá-lo.
 */
function calledInStation(day: SessionDay, stationId: string): CalledInStation {
  if (day.state !== "open") return { ok: false, error: "session_closed" };
  const station = day.stations.find((e) => e.id === stationId);
  const item = station?.calledItemId ? day.items.find((i) => i.id === station.calledItemId) : undefined;
  if (!station || item?.state !== "called") return { ok: false, error: "forbidden_transition" };
  return { ok: true, station, item };
}

/** Índice da chamada em curso do item (a última dele). */
const lastCall = (day: SessionDay, itemId: string): number => day.calls.findLastIndex((c) => c.itemId === itemId);

const withCall = (day: SessionDay, idx: number, partial: { showedUpAt?: number }): SessionDay => ({
  ...day,
  calls: day.calls.map((c, i) => {
    if (i !== idx) return c;
    const { showedUpAt: _, ...rest } = c;
    return partial.showedUpAt === undefined ? rest : { ...rest, showedUpAt: partial.showedUpAt };
  }),
});

/**
 * Quem a fila ainda espera entrar na sala: item chamado (`called`) sem o "Compareceu" na última chamada.
 * Os avisos de chamada só saem para eles (AD-074): atendido, pulado ou já na sala, o aviso perdeu a hora.
 */
export function awaitedItems(day: SessionDay): Set<string> {
  const awaited = new Set<string>();
  for (const i of day.items) {
    if (i.state === "called" && (day.calls[lastCall(day, i.id)]?.showedUpAt ?? null) === null) awaited.add(i.id);
  }
  return awaited;
}

/**
 * Quem ainda espera em casa (remoto), com a etapa em que espera. Os avisos de tempo ("saia de casa", "venha
 * agora") só saem para eles, na mesma etapa (AD-074): quem já chegou à unidade não precisa mais deles.
 */
export function remoteItems(day: SessionDay): Map<string, Stage> {
  return new Map(day.items.filter((i) => i.state === "remote").map((i) => [i.id, i.stage]));
}

/** Hora do "Compareceu" de quem está chamado na estação, ou `null`. */
export function showedUpAt(day: SessionDay, stationId: string): number | null {
  const found = calledInStation(day, stationId);
  if (!found.ok) return null;
  return day.calls[lastCall(day, found.item.id)]?.showedUpAt ?? null;
}

/** A pessoa chamada entrou na sala: grava a hora; repetir não muda nada. */
export function showedUp(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  const found = calledInStation(day, cmd.stationId);
  if (!found.ok) return failure(found.error);
  if (showedUpAt(day, cmd.stationId) !== null) return ok(day);
  return ok(withCall(day, lastCall(day, found.item.id), { showedUpAt: now }), [
    { kind: "showed_up", ...base(day, found.item, cmd.stationId), data: { at: now } },
  ]);
}

/** Desfaz o "Compareceu" (clique errado): volta a esperar a pessoa entrar. */
export function undoShowedUp(day: SessionDay, cmd: Cmd, _now: number): Result<SessionDay> {
  const found = calledInStation(day, cmd.stationId);
  if (!found.ok) return failure(found.error);
  if (showedUpAt(day, cmd.stationId) === null) return failure("forbidden_transition");
  return ok(withCall(day, lastCall(day, found.item.id), {}));
}

/**
 * Fechar o chamado pede a pessoa na sala: na triagem, sem "Compareceu" recusa (a classificação
 * exige a pessoa ali); no atendimento, marca o comparecimento na hora de fechar.
 */
function requireShowUp(
  day: SessionDay,
  station: Station,
  item: QueueItem,
  now: number,
): { ok: true; day: SessionDay } | { ok: false } {
  const idx = lastCall(day, item.id);
  if (day.calls[idx]?.showedUpAt !== undefined) return { ok: true, day };
  if (station.stage === "triage") return { ok: false };
  return { ok: true, day: withCall(day, idx, { showedUpAt: now }) };
}

/**
 * Risco confirmado na saída da triagem (RN-TRI-03): só na etapa de triagem. Encaminhar à
 * emergência só com vermelho (AD-059).
 */
function invalidRisk(item: QueueItem | undefined, cmd: CmdClose): ErrorCode | null {
  // RN-PERF-05: classificar é do enfermeiro (Cofen 661/2021).
  if (cmd.classifies === false && (cmd.confirmedRisk !== undefined || cmd.refer)) return "forbidden_transition";
  if (cmd.refer && cmd.confirmedRisk !== "emergency") return "forbidden_transition";
  if (cmd.confirmedRisk === undefined) return null;
  return item?.state !== "called" || item.stage !== "triage" ? "forbidden_transition" : null;
}

/**
 * Encerra o chamado como atendido na etapa (RN-CHAM-02). Da triagem, entra presente no atendimento
 * com a mesma senha e o mesmo número, sem regra de atraso (RN-TRI-04), já com o risco confirmado
 * pela triagem, se houver (RN-TRI-03/04: a ordem do atendimento usa a classificação confirmada).
 */
function closeCalled(
  day: SessionDay,
  station: Station,
  item: QueueItem,
  now: number,
  confirmedRisk?: RiskLevel,
  refer = false,
  classifies = true,
): { day: SessionDay; events: Event[] } {
  // RN-PERF-05: o técnico fecha o acolhimento na triagem; a pessoa volta presente à triagem, marcada
  // como acolhida, e quem classifica a chama antes dos outros.
  if (!classifies && item.stage === "triage") {
    if (applyTransition(ITEM_TRANSITIONS, item.state, EVENT_WELCOMED) !== "present") {
      throw new Error(`contrato: ${item.state} não volta do acolhimento`);
    }
    const free = withStation(day, station.id, { calledItemId: null });
    return {
      day: withItem(free, { ...item, state: "present", welcomed: true }),
      events: [{ kind: "welcomed", ...base(day, item, station.id), data: { at: now } }],
    };
  }
  if (applyTransition(ITEM_TRANSITIONS, item.state, EVENT_CLOSE) !== "done_in_stage") {
    throw new Error(`contrato: ${item.state} não encerra`);
  }
  const attendedInStages = [...item.attendedInStages, item.stage];
  // AD-059: vermelho vai ao 1º lugar do atendimento; só "encaminhar" tira da fila desta unidade.
  const emergency = refer && confirmedRisk === "emergency";
  const nextStage = item.stage === "triage" && !emergency ? ("care" as const) : null;
  const events: Event[] = [
    { kind: "attended", ...base(day, item, station.id), data: { stage: item.stage, nextStage, at: now } },
  ];
  // O risco confirmado fica no item do dia, inclusive de quem é encaminhado: o dia e a entrada concordam.
  // A API grava entry.confirmedRisk (INV-07: só agendador ou triagem).
  const classified: QueueItem = item.welcomed ? { ...item, welcomed: false } : item;
  const confirmed: QueueItem =
    confirmedRisk === undefined
      ? classified
      : { ...classified, risk: confirmedRisk, confirmedUrgency: isUrgent(confirmedRisk) };
  if (confirmedRisk !== undefined) {
    events.push({
      kind: "risk_confirmed",
      ...base(day, item, station.id),
      data: { level: confirmedRisk, stage: item.stage },
    });
  }
  if (emergency) {
    events.push({ kind: "referred_to_emergency", ...base(day, item, station.id), data: { stage: item.stage } });
  }
  const free = withStation(day, station.id, { calledItemId: null });
  if (nextStage === null) {
    return { day: withItem(free, { ...confirmed, state: "done_in_stage", attendedInStages }), events };
  }
  let triaged: QueueItem = { ...confirmed, stage: nextStage, attendedInStages, leftAt: null };
  // RN-TRI-04 (2026-11-13): o atendimento é uma fila nova. Quem sai da triagem recebe o próximo
  // número e entra atrás de quem já estava no atendimento, dentro do seu nível de risco e prioridade;
  // sem janela protegida e sem regra de atraso (a pessoa estava na unidade). A senha não muda.
  triaged = { ...triaged, state: "present", number: free.nextNumber, lockedBehind: [], presentSince: now };
  return { day: { ...withItem(free, triaged), nextNumber: free.nextNumber + 1 }, events };
}

const stationOf = (day: SessionDay, id: string): Station => day.stations.find((e) => e.id === id) as Station;
const withStationState = (day: SessionDay, e: Station): SessionDay =>
  e === stationOf(day, e.id) ? day : { ...day, stations: day.stations.map((x) => (x.id === e.id ? e : x)) };

/**
 * RN-CHAM-01/02: encerra o chamado anterior desta estação e chama o 1º elegível dela. Na triagem,
 * `confirmedRisk` confirma ou reclassifica o risco de quem sai (RN-TRI-03).
 * Sem elegível, o chamado anterior é finalizado e a estação fica livre (ok, sem evento "chamado");
 * sem chamado anterior (ou estação fechada), `nenhum_elegivel` sem mudar nada. Em pausa (RN-EST-06), só
 * finaliza o chamado anterior; sem ele, `station_paused`. A seleção usa o estado recebido: uma 2ª estação chamando
 * sobre o estado devolvido pela 1ª não pega o mesmo paciente (INV-04).
 */
export function callNext(day: SessionDay, cmd: CmdClose, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const station = day.stations.find((e) => e.id === cmd.stationId);
  if (!station?.open) return failure("none_eligible");
  const previous = station.calledItemId ? day.items.find((i) => i.id === station.calledItemId) : undefined;
  // Chamado de outra sessão em aberto nesta estação: não é derrubado.
  if (station.calledItemId !== null && previous === undefined) return failure("station_busy");
  const invalid = invalidRisk(previous, cmd);
  if (invalid) return failure(invalid);

  let current = day;
  const events: Event[] = [];
  if (previous?.state === "called") {
    const present = requireShowUp(current, station, previous, now);
    if (!present.ok) return failure("no_show_up");
    current = present.day;
    const closed = closeCalled(current, station, previous, now, cmd.confirmedRisk, cmd.refer, cmd.classifies);
    current = closed.day;
    events.push(...closed.events);
  }
  // O relógio da pausa: o atendimento que acabou de terminar deixa a pausa marcada começar agora.
  current = withStationState(current, advance(stationOf(current, station.id), now, events.length > 0));
  // Em pausa (RN-EST-06): só finaliza o chamado anterior, não chama ninguém.
  if (pausedAt(current, stationOf(current, station.id), now)) {
    if (events.length > 0) return ok(current, events);
    // No intervalo da sessão, "voltar agora" não resolve, a não ser que a pausa própria passe dele.
    const own = stationOf(current, station.id).pause;
    const breakEnd = Math.max(...(current.breaks ?? []).filter((b) => b.start <= now && now < b.end).map((b) => b.end));
    // A pausa própria em curso, ou marcada para começar ainda no intervalo, que passa dele.
    const ownInBreak = own?.state === "paused" || (own?.state === "scheduled" && own.from < breakEnd);
    const ownPastBreak = own !== undefined && ownInBreak && (own.until === null || own.until > breakEnd);
    return failure(inBreak(current, now) && !ownPastBreak ? "session_break" : "station_paused");
  }
  const next = eligible(current, station.id, { classifies: cmd.classifies ?? true })[0];
  // RN-CHAM-01: sem elegível, o chamado anterior fica encerrado e a estação livre ("ninguém aguardando").
  if (!next) return events.length > 0 ? ok(current, events) : failure("none_eligible");
  if (applyTransition(ITEM_TRANSITIONS, next.state, EVENT_CALL) !== "called") {
    throw new Error(`contrato: ${next.state} não é chamado`);
  }
  current = releaseLocks(current, next.id);
  current = withItem(current, { ...next, state: "called", lockedBehind: [] });
  current = withStation(current, station.id, { calledItemId: next.id });
  current = {
    ...current,
    calls: [
      ...current.calls,
      { itemId: next.id, stage: next.stage, stationId: station.id, at: now, orderKey: orderKey(next) },
    ],
  };
  events.push({
    kind: "called",
    ...base(day, next, station.id),
    data: { ticket: next.ticket, stage: next.stage, at: now },
  });
  return ok(current, events);
}

/** RN-CHAM-02: repete o anúncio; a tolerância conta da chamada, então não reinicia. */
export function recall(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  const found = calledInStation(day, cmd.stationId);
  if (!found.ok) return failure(found.error);
  if (applyTransition(ITEM_TRANSITIONS, found.item.state, "Rechamar") !== "(mesmo)")
    return failure("forbidden_transition");
  if (showedUpAt(day, cmd.stationId) !== null) return failure("forbidden_transition");
  const last = day.calls.findLastIndex((c) => c.itemId === found.item.id);
  const calls = day.calls.map((c, i) => (i === last ? { ...c, recalls: [...(c.recalls ?? []), now] } : c));
  return ok({ ...day, calls }, [
    { kind: "recalled", ...base(day, found.item, cmd.stationId), data: { ticket: found.item.ticket, at: now } },
  ]);
}

/** RN-CHAM-02: encerra o atendimento atual sem chamar outro; na triagem, com o risco confirmado (RN-TRI-03). */
export function finish(day: SessionDay, cmd: CmdClose, now: number): Result<SessionDay> {
  const found = calledInStation(day, cmd.stationId);
  if (!found.ok) return failure(found.error);
  const invalid = invalidRisk(found.item, cmd);
  if (invalid) return failure(invalid);
  const present = requireShowUp(day, found.station, found.item, now);
  if (!present.ok) return failure("no_show_up");
  const closed = closeCalled(present.day, found.station, found.item, now, cmd.confirmedRisk, cmd.refer, cmd.classifies);
  const free = closed.day;
  return ok(withStationState(free, advance(stationOf(free, found.station.id), now, true)), closed.events);
}

/** Linha do contrato escolhida pelos pulos no dia (a transição depende da condição). */
function skipDestination(skips: number): ItemState {
  const condition = `Pulos no dia = ${Math.min(skips, 1)}`;
  const row = ITEM_TRANSITIONS.find((t) => t.de === "called" && t.event === EVENT_NO_SHOW && t.condition === condition);
  if (!row || row.for === "(mesmo)" || row.for === "(não cria)") {
    throw new Error(`contrato: sem linha para ${condition}`);
  }
  return row.for;
}

/**
 * RN-CHAM-03 (AD-076): os pulos somam as etapas. 1º: a vez fica guardada, presente atrás dos próximos K,
 * sem atraso; 2º: sai da fila com falta "não compareceu à chamada" (RN-FALTA-02), também com urgência
 * confirmada; a entrada vai a "Encerrada sem atendimento" com `entryOutcome` (ou no encerramento).
 */
export function noShow(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  const found = calledInStation(day, cmd.stationId);
  if (!found.ok) return failure(found.error);
  const { item } = found;
  if (showedUpAt(day, cmd.stationId) !== null) return failure("forbidden_transition");
  const to = skipDestination(item.skips);
  const skips = item.skips + 1;
  const free = withStation(day, cmd.stationId, { calledItemId: null });
  const ids = base(day, item, cmd.stationId);
  const skipped: Event = { kind: "skipped", ...ids, data: { skips, for: to, at: now } };
  const lastCall = day.calls.findLastIndex((c) => c.itemId === item.id);
  // O atendimento terminou: a pausa marcada que chegou nele começa agora.
  const markSkip = (d: SessionDay): SessionDay => {
    const marked = { ...d, calls: d.calls.map((c, i) => (i === lastCall ? { ...c, noShow: true } : c)) };
    return withStationState(marked, advance(stationOf(marked, cmd.stationId), now, true));
  };

  if (to === "present") {
    const eleg = stayEligible(withItem(free, { ...item, skips }), item.id, now, { applyDelay: false });
    return ok(markSkip(eleg.state), [skipped]);
  }
  const outside: QueueItem = {
    ...item,
    state: to,
    skips,
    lockedBehind: [],
    presentSince: null,
    exitReason: "skips",
  };
  const current = releaseLocks(withItem(free, outside), item.id);
  return ok(markSkip(current), [
    skipped,
    { kind: "no_show", ...ids, reason: "não compareceu à chamada" },
    { kind: "left_queue", ...ids },
  ]);
}

export const openIn = (day: SessionDay, stage: Stage, except: string) =>
  day.stations.some((e) => e.id !== except && e.open && e.stage === stage && e.services.includes(day.serviceId));

/**
 * RN-EST-07: o que fechar a estação faz com a fila. Fechar é de verdade (só a pausa é passageira): sem outra
 * estação aberta no atendimento, a última etapa, ninguém mais seria atendido e a sessão é encerrada
 * (`closes_session`); sem outra na triagem, a triagem fecha: quem espera por ela sai como no encerramento
 * (`closes_stage`, `closeStage`) e a sessão não aceita gente nova até reabrir (`triageClosed`). Nulo quando a
 * fila segue com as outras estações.
 */
export function closingConsequence(day: SessionDay, stationId: string): "closes_session" | "closes_stage" | null {
  const station = day.stations.find((e) => e.id === stationId);
  if (!station?.open || !station.services.includes(day.serviceId)) return null;
  if (station.stage === "care") return openIn(day, "care", station.id) ? null : "closes_session";
  return !day.requiresTriage || openIn(day, "triage", station.id) ? null : "closes_stage";
}

/**
 * RN-EST-05: não fecha com paciente chamado (de qualquer sessão); finalize ou marque "Não compareceu".
 * Como as ações vizinhas, só com a sessão aberta (m5). Se fechar encerra a sessão ou a triagem
 * (`closingConsequence`), recusa com esse código até vir `confirmed`; quem chama encerra em seguida
 * (`close` ou `closeStage`).
 */
export function closeStation(day: SessionDay, cmd: Cmd & { confirmed?: boolean }, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const station = day.stations.find((e) => e.id === cmd.stationId);
  if (!station) return failure("forbidden_transition");
  // Já fechada (toque duplo, nova tentativa): nada muda.
  if (!station.open) return ok(day);
  if (station.calledItemId !== null) return failure("station_has_call");
  const consequence = closingConsequence(day, station.id);
  if (consequence !== null && !cmd.confirmed) return failure(consequence);
  // A sessão só encerra sem ninguém chamado (RN-SES-01): sem isso, o atendimento ficaria sem estação.
  const anyCalled = day.stations.some((e) => e.calledItemId !== null) || day.items.some((i) => i.state === "called");
  if (consequence === "closes_session" && anyCalled) return failure("station_has_call");
  // A pausa sai (em pausa, vira parada no histórico); o tempo fechada conta a partir de agora.
  const current = advance(station, now);
  const left = current.pause ? leavePause(current, "Fechar a estação", now) : current;
  const closed = { ...left, open: false, closedAt: now };
  return ok({ ...day, stations: day.stations.map((e) => (e.id === station.id ? closed : e)) }, [
    { kind: "station_closed", stationId: station.id },
  ]);
}

/**
 * AD-006: a tolerância é só um contador desde a chamada (Rechamar não reinicia); esgotada,
 * a estação avisa, mas ninguém é pulado sozinho.
 */
export function toleranceExceeded(day: SessionDay, stationId: string, now: number): boolean {
  const found = calledInStation(day, stationId);
  if (!found.ok) return false;
  const last = day.calls.findLast((c) => c.itemId === found.item.id && c.stage === found.item.stage);
  if (!last || last.showedUpAt !== undefined) return false;
  return now - last.at >= day.config.toleranceMin * MIN;
}
