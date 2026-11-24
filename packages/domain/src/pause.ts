import { callNext } from "./call.ts";
import { inManualMode, pendingOutage } from "./outage.ts";
import { inBreak, startPauseNow, waitingBeforePause, withStop } from "./pause-time.ts";
import { DEFAULT_CONFIG, extendedDeadlineEnd, lateness, type SessionDay, type Stage, type Station } from "./queue.ts";
import { type Event, failure, ok, type Result } from "./result.ts";

export { callingAt, type Pause, pausedAt, stagePause, waitingBeforePause } from "./pause-time.ts";

type Cmd = { stationId: string };
/** A volta: num horário, em minutos contados do início da pausa, ou sem hora (nulo). */
export type PauseBack = { at: number } | { inMin: number } | null;

const MIN = 60_000;

const withStation = (day: SessionDay, e: Station): SessionDay => ({
  ...day,
  stations: day.stations.map((x) => (x.id === e.id ? e : x)),
});

/** Quem da etapa está a caminho: recebeu "venha agora" e ainda está no prazo (a urgência que passou dele não, PA5). */
function onTheWayItems(day: SessionDay, stage: Stage, now: number) {
  return day.items.filter(
    (i) =>
      i.state === "remote" &&
      i.stage === stage &&
      extendedDeadlineEnd(day, i, now) !== null &&
      lateness(day, i, now) !== "late",
  );
}

/** Quando acaba o prazo de quem da etapa está a caminho (inclusive estendido por uma queda); nulo sem ninguém. */
function onTheWayUntil(day: SessionDay, stage: Stage, now: number): number | null {
  const ends = onTheWayItems(day, stage, now).map((i) => extendedDeadlineEnd(day, i, now) as number);
  return ends.length > 0 ? Math.max(...ends) : null;
}

/**
 * Pausa avisada (plano-pausa-e-fechar): a pausa nunca pega ninguém a caminho. Com alguém da etapa a caminho
 * (no prazo do "venha agora", ou no prazo estendido por uma queda), começa depois do prazo da unidade, ou do
 * prazo estendido se for maior; senão, agora. Pausar de novo (trocar a volta) mantém o início. A volta é
 * opcional; em minutos, conta do início da pausa; antes do início, recusa. Não pausa com paciente chamado
 * (como fechar, RN-EST-05), nem estação fechada.
 */
export function pauseStation(day: SessionDay, cmd: Cmd & { back: PauseBack }, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e?.open) return failure("forbidden_transition");
  // Com queda aberta ou por confirmar, o prazo de quem vem pode crescer: não dá para saber quando pausar.
  if (inManualMode(day) || pendingOutage(day, now)) return failure("pause_during_outage");
  // Com pausa marcada ou em curso, é preciso voltar (ou desmarcar) antes de pausar de novo.
  if (e.pause && (e.pause.until === null || e.pause.until > now)) return failure("station_already_paused");
  if (e.calledItemId !== null) return failure("station_has_call");
  const deadline = (day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin) * MIN;
  const onTheWay = onTheWayUntil(day, e.stage, now);
  const from = onTheWay === null ? now : Math.max(now + deadline, onTheWay);
  const back = cmd.back;
  // Minutos: do início da pausa.
  const until = back === null ? null : "at" in back ? back.at : from + back.inMin * MIN;
  if (until !== null && !(Number.isFinite(until) && until > from)) return failure("pause_back_before_start");
  // A pausa que acabou sozinha deixa a hora da volta: o silêncio de antes dela não é queda.
  // A pausa adiada não parou a estação: não vira parada.
  const old = e.pause?.until != null && !e.pause.deferred ? { start: e.pause.from, end: e.pause.until } : undefined;
  const since = old === undefined ? {} : { callingSince: Math.max(e.callingSince ?? old.end, old.end) };
  const waitFor = onTheWayItems(day, e.stage, now).map((i) => i.id);
  const pause = { from, until, ...(waitFor.length > 0 ? { waitFor } : {}) };
  return ok(withStation(day, { ...e, ...since, ...withStop(e, old), pause }), [
    { kind: "station_paused", stationId: e.id, data: { from, until } },
  ]);
}

/** "Voltar agora" (em pausa) ou "desmarcar a pausa" (ainda não começou): a estação volta a chamar. */
export function resumeStation(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e?.pause) return failure("forbidden_transition");
  if (e.pause.until !== null && e.pause.until <= now) return failure("forbidden_transition");
  const { pause, ...rest } = e;
  // A pausa adiada (atender antes de pausar) não parou a estação: não vira parada.
  const started = pause.from <= now && !pause.deferred ? { start: pause.from, end: now } : undefined;
  const kept = { ...rest, ...withStop(e, started) };
  const events = [{ kind: "station_resumed" as const, stationId: e.id }];
  // No almoço da sessão, tira a pausa própria, mas a estação só chama no fim do almoço (que já conta como volta).
  if (inBreak(day, now)) return ok(withStation(day, kept), events);
  // Pausa que já começou: o silêncio conta da volta (desmarcar antes do início não muda nada).
  return ok(withStation(day, started ? { ...kept, callingSince: now } : kept), events);
}

/** Reabrir a estação fechada (fechou por engano): volta a chamar nesta sessão. */
export function reopenStation(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e || e.open) return failure("forbidden_transition");
  const { closedAt, ...rest } = e;
  const closed = closedAt === undefined ? undefined : { start: closedAt, end: now };
  return ok(withStation(day, { ...rest, ...withStop(e, closed), open: true, callingSince: now }), [
    { kind: "station_reopened", stationId: e.id },
  ]);
}

/**
 * Opção C, "atender antes de pausar": chama o próximo (quem chegou no prazo está na frente) e adia a pausa
 * até o profissional finalizar; ela começa então, com a mesma duração.
 */
export function serveBeforePause(
  day: SessionDay,
  cmd: Cmd & { classifies?: boolean },
  now: number,
): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (inBreak(day, now)) return failure("session_break");
  if (!e?.pause || waitingBeforePause(day, e.id, now).length === 0) return failure("forbidden_transition");
  if (e.calledItemId !== null) return failure("station_has_call");
  const deferred = withStation(day, { ...e, pause: { ...e.pause, deferred: true } });
  return callNext(
    deferred,
    { stationId: e.id, ...(cmd.classifies === undefined ? {} : { classifies: cmd.classifies }) },
    now,
  );
}

/** A justificativa para quem chegou no prazo e ficou para a volta; `waitFor` sai para não repetir. */
function notifyWaiting(day: SessionDay, e: Station, now: number): { day: SessionDay; events: Event[] } {
  if (!e.pause?.waitFor || e.pause.deferred || e.pause.from > now) return { day, events: [] };
  // A pausa já acabou: a justificativa não faz mais sentido.
  if (e.pause.until !== null && e.pause.until <= now) {
    const { waitFor: _, askedAt: __, ...pause } = e.pause;
    return { day: withStation(day, { ...e, pause }), events: [] };
  }
  const events: Event[] = waitingBeforePause(day, e.id, now).map((i) => ({
    kind: "turn_after_pause",
    itemId: i.id,
    stationId: e.id,
    data: { until: e.pause?.until ?? null },
  }));
  const { waitFor: _, askedAt: __, ...pause } = e.pause;
  return { day: withStation(day, { ...e, pause }), events };
}

/** Opção C, "pausar agora": a pausa começa (a adiada, agora) e quem chegou no prazo recebe a justificativa. */
export function confirmPause(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e?.pause || e.pause.from > now) return failure("forbidden_transition");
  if (e.pause.until !== null && e.pause.until <= now) return failure("forbidden_transition");
  if (e.calledItemId !== null) return failure("station_has_call");
  if (!e.pause.waitFor && !e.pause.deferred) return ok(day);
  const r = startPauseNow(day, e.id, now);
  return ok(r.day, r.events);
}

/** Tempo para a estação responder "atender antes de pausar?" depois de ficar livre na hora da pausa. */
export const PAUSE_ANSWER_MS = 3 * 60_000;

/**
 * Varredura: a pausa começou e a estação não respondeu. Com paciente em atendimento (ou atendendo antes de
 * pausar), espera; livre, marca quando viu e, passado `PAUSE_ANSWER_MS`, manda a justificativa, uma vez.
 */
export function pauseStartNotices(day: SessionDay, now: number): { day: SessionDay; events: Event[] } {
  let current = day;
  const events: Event[] = [];
  for (const e of day.stations) {
    const station = current.stations.find((x) => x.id === e.id) as Station;
    const p = station.pause;
    if (!p || (!p.waitFor && !p.deferred) || p.from > now || station.calledItemId !== null) continue;
    // A pausa já acabou: a adiada some, e a justificativa não faz mais sentido.
    if (p.until !== null && p.until <= now) {
      current = p.deferred ? startPauseNow(current, station.id, now).day : notifyWaiting(current, station, now).day;
      continue;
    }
    if (p.askedAt === undefined) {
      current = withStation(current, { ...station, pause: { ...p, askedAt: now } });
      continue;
    }
    if (now - p.askedAt < PAUSE_ANSWER_MS) continue;
    const r = startPauseNow(current, station.id, now);
    current = r.day;
    events.push(...r.events);
  }
  return { day: current, events };
}
