import { inBreak } from "./pause-time.ts";
import { DEFAULT_CONFIG, extendedDeadlineEnd, lateness, type SessionDay, type Stage, type Station } from "./queue.ts";
import { failure, ok, type Result } from "./result.ts";

export { callingAt, type Pause, pausedAt, stagePause } from "./pause-time.ts";

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
function onTheWayUntil(day: SessionDay, stage: Stage, now: number): number | null {
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
  // A pausa marcada ou em curso mantém o início; a que já acabou dá lugar a uma nova.
  const current = e.pause && (e.pause.until === null || e.pause.until > now) ? e.pause : null;
  // Trocar a volta pode com paciente chamado (a estação chama até a pausa começar); pausar, não.
  if (!current && e.calledItemId !== null) return failure("station_has_call");
  const deadline = (day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin) * MIN;
  const onTheWay = onTheWayUntil(day, e.stage, now);
  const from = current?.from ?? (onTheWay === null ? now : Math.max(now + deadline, onTheWay));
  const back = cmd.back;
  const until = back === null ? null : "at" in back ? back.at : from + back.inMin * MIN;
  if (until !== null && !(Number.isFinite(until) && until > Math.max(from, now)))
    return failure("pause_back_before_start");
  return ok(withStation(day, { ...e, pause: { from, until } }));
}

/** "Voltar agora" (em pausa) ou "desmarcar a pausa" (ainda não começou): a estação volta a chamar. */
export function resumeStation(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e?.pause) return failure("forbidden_transition");
  if (e.pause.until !== null && e.pause.until <= now) return failure("forbidden_transition");
  // Na pausa planejada da sessão (almoço) ninguém volta antes da hora.
  if (e.pause.from <= now && inBreak(day, now)) return failure("station_paused");
  const { pause, ...rest } = e;
  // Pausa que já começou: o silêncio conta da volta (desmarcar antes do início não muda nada).
  return ok(withStation(day, pause.from <= now ? { ...rest, callingSince: now } : rest));
}

/** Reabrir a estação fechada (fechou por engano): volta a chamar nesta sessão. */
export function reopenStation(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e || e.open) return failure("forbidden_transition");
  return ok(withStation(day, { ...e, open: true, callingSince: now }));
}
