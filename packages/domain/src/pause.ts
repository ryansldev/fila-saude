import { inManualMode, pendingOutage } from "./outage.ts";
import { advance, inBreak, leavePause, withStop } from "./pause-time.ts";
import { DEFAULT_CONFIG, extendedDeadlineEnd, lateness, type SessionDay, type Stage, type Station } from "./queue.ts";
import { failure, ok, type Result } from "./result.ts";

export { advancePauses, callingAt, type Pause, pausedAt, pauseState, stagePause } from "./pause-time.ts";

type Cmd = { stationId: string };
/** A volta: num horário, em minutos contados do início da pausa, ou sem hora (nulo). */
export type PauseBack = { at: number } | { inMin: number } | null;

const MIN = 60_000;

const withStation = (day: SessionDay, e: Station): SessionDay => ({
  ...day,
  stations: day.stations.map((x) => (x.id === e.id ? e : x)),
});

/** Quem da etapa está a caminho: recebeu "venha agora" e ainda está no prazo (a urgência que passou dele não, PA5). */
function onTheWayUntil(day: SessionDay, stage: Stage, now: number): number | null {
  const ends = day.items
    .filter((i) => i.state === "remote" && i.stage === stage && lateness(day, i, now) !== "late")
    .map((i) => extendedDeadlineEnd(day, i, now))
    .filter((end): end is number => end !== null);
  return ends.length > 0 ? Math.max(...ends) : null;
}

/**
 * "Pausar" (RN-EST-06): sem pausa → marcada. A pausa nunca pega ninguém a caminho: com alguém da etapa no prazo
 * do "venha agora" (ou no prazo estendido por uma queda), começa depois do prazo da unidade, ou do estendido se
 * for maior; senão, agora (e já entra em pausa). Com pausa marcada ou em curso, recusa (volte ou desmarque
 * antes). A volta é opcional; em minutos, conta do início; antes do início, recusa. Não pausa com paciente
 * chamado, estação fechada ou a unidade sem sinal (PA4).
 */
export function pauseStation(day: SessionDay, cmd: Cmd & { back: PauseBack }, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const found = day.stations.find((x) => x.id === cmd.stationId);
  if (!found?.open) return failure("forbidden_transition");
  const e = advance(found, now);
  if (e.pause) return failure("station_already_paused");
  if (e.calledItemId !== null) return failure("station_has_call");
  // Com queda aberta ou por confirmar, o prazo de quem vem pode crescer: não dá para saber quando pausar.
  if (inManualMode(day) || pendingOutage(day, now)) return failure("pause_during_outage");
  const deadline = (day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin) * MIN;
  const onTheWay = onTheWayUntil(day, e.stage, now);
  const from = onTheWay === null ? now : Math.max(now + deadline, onTheWay);
  const back = cmd.back;
  const until = back === null ? null : "at" in back ? back.at : from + back.inMin * MIN;
  if (until !== null && !(Number.isFinite(until) && until > from)) return failure("pause_back_before_start");
  const scheduled = advance({ ...e, pause: { state: "scheduled", from, until } }, now);
  return ok(withStation(day, scheduled), [{ kind: "station_paused", stationId: e.id, data: { from, until } }]);
}

/**
 * "Voltar agora" (em pausa) ou "Desmarcar a pausa" (marcada): sem pausa. Em pausa, ela vira parada no
 * histórico e o silêncio conta da volta. No intervalo da sessão, tira a pausa própria, mas a estação só chama
 * no fim dele (que já conta como volta).
 */
export function resumeStation(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const found = day.stations.find((x) => x.id === cmd.stationId);
  if (!found) return failure("forbidden_transition");
  const e = advance(found, now);
  if (!e.pause) return failure("forbidden_transition");
  const paused = e.pause.state === "paused";
  const back = leavePause(e, paused ? "Voltar agora" : "Desmarcar a pausa", now);
  const since = paused && !inBreak(day, now) ? { callingSince: now } : {};
  return ok(withStation(day, { ...back, ...since }), [{ kind: "station_resumed", stationId: e.id }]);
}

/** Reabrir a estação fechada (fechou por engano): volta a chamar nesta sessão; o tempo fechada vira parada. */
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
