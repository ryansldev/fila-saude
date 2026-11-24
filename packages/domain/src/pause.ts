import { callNext } from "./call.ts";
import { inManualMode, pendingOutage } from "./outage.ts";
import { inBreak, waitingBeforePause, withStop } from "./pause-time.ts";
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

/**
 * Quando acaba o prazo de quem da etapa está a caminho (recebeu "venha agora" e não perdeu a vez, inclusive
 * com o prazo estendido por uma queda); nulo sem ninguém a caminho.
 */
function onTheWayItems(day: SessionDay, stage: Stage, now: number) {
  // Só segura a pausa quem ainda está no prazo (a urgência confirmada que passou dele também não, PA5).
  return day.items.filter(
    (i) =>
      i.state === "remote" &&
      i.stage === stage &&
      extendedDeadlineEnd(day, i, now) !== null &&
      lateness(day, i, now) !== "late",
  );
}

function onTheWayUntil(day: SessionDay, stage: Stage, now: number): number | null {
  // Só segura a pausa quem ainda está no prazo (a urgência confirmada que passou dele também não, PA5).
  const ends = day.items
    .filter((i) => i.state === "remote" && i.stage === stage && lateness(day, i, now) !== "late")
    .map((i) => extendedDeadlineEnd(day, i, now))
    .filter((end): end is number => end !== null);
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
  const old = e.pause?.until != null ? { start: e.pause.from, end: e.pause.until } : undefined;
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
  const started = pause.from <= now ? { start: pause.from, end: now } : undefined;
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
export function serveBeforePause(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e?.pause || waitingBeforePause(day, e.id, now).length === 0) return failure("forbidden_transition");
  if (e.calledItemId !== null) return failure("station_has_call");
  return callNext(withStation(day, { ...e, pause: { ...e.pause, deferred: true } }), { stationId: e.id }, now);
}

/** A justificativa para quem chegou no prazo e ficou para a volta; `waitFor` sai para não repetir. */
function notifyWaiting(day: SessionDay, e: Station, now: number): { day: SessionDay; events: Event[] } {
  if (!e.pause?.waitFor || e.pause.deferred || e.pause.from > now) return { day, events: [] };
  const events: Event[] = waitingBeforePause(day, e.id, now).map((i) => ({
    kind: "turn_after_pause",
    itemId: i.id,
    stationId: e.id,
    data: { until: e.pause?.until ?? null },
  }));
  const { waitFor: _, ...pause } = e.pause;
  return { day: withStation(day, { ...e, pause }), events };
}

/** Opção C, "pausar agora": a pausa segue, e quem chegou no prazo recebe a justificativa (uma vez). */
export function confirmPause(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e?.pause) return failure("forbidden_transition");
  if (!e.pause.waitFor) return ok(day);
  const r = notifyWaiting(day, e, now);
  return ok(r.day, r.events);
}

/** Varredura: a pausa começou sem resposta da estação; a justificativa sai do mesmo jeito, uma vez. */
export function pauseStartNotices(day: SessionDay, now: number): { day: SessionDay; events: Event[] } {
  let current = day;
  const events: Event[] = [];
  for (const e of day.stations) {
    const station = current.stations.find((x) => x.id === e.id) as Station;
    const r = notifyWaiting(current, station, now);
    current = r.day;
    events.push(...r.events);
  }
  return { day: current, events };
}
