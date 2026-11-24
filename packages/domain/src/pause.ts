import { DEFAULT_CONFIG, extendedDeadlineEnd, lateness, type SessionDay, type Stage, type Station } from "./queue.ts";
import { failure, ok, type Result } from "./result.ts";

/** Uma pausa: desde `from`; `until` nulo, sem hora de volta. */
export type Pause = { from: number; until: number | null };

type Cmd = { stationId: string };
/** A volta: num horário, em minutos contados do início da pausa, ou sem hora (nulo). */
export type PauseBack = { at: number } | { inMin: number } | null;

const MIN = 60_000;
const NEVER = Number.POSITIVE_INFINITY;

const serves = (day: SessionDay, e: Station, stage: Stage) =>
  e.open && e.stage === stage && e.services.includes(day.serviceId);

/** Intervalos em que a estação não chama: a pausa dela e as pausas planejadas da sessão (vão entre faixas). */
function intervals(day: SessionDay, e: Station): { start: number; end: number }[] {
  const own = e.pause ? [{ start: e.pause.from, end: e.pause.until ?? NEVER }] : [];
  return [...own, ...(day.breaks ?? []).map((b) => ({ start: b.start, end: b.end }))];
}

const covering = (day: SessionDay, e: Station, t: number) => intervals(day, e).find((i) => i.start <= t && t < i.end);

/** Quando a estação volta a chamar depois de `t` (pausas emendadas contam juntas); `NEVER` sem hora de volta. */
function resumesAt(day: SessionDay, e: Station, t: number): number {
  let r = t;
  for (let guard = 0; guard < 50; guard++) {
    const c = covering(day, e, r);
    if (!c) return r;
    if (c.end === NEVER) return NEVER;
    r = c.end;
  }
  return r;
}

/** A estação está em pausa em `t` (a dela ou a planejada da sessão). */
export function pausedAt(day: SessionDay, e: Station, t: number): boolean {
  return covering(day, e, t) !== undefined;
}

/** Desde quando a estação chama de novo em `t`: o fim da última pausa (dela ou da sessão) até `t`. */
export function resumedAt(day: SessionDay, e: Station, t: number): number {
  const ends = [...intervals(day, e).map((i) => i.end), e.callingSince ?? Number.NEGATIVE_INFINITY];
  return Math.max(Number.NEGATIVE_INFINITY, ...ends.filter((end) => end <= t));
}

/** A estação chama em `t`: aberta (não fechada) e fora de pausa. */
export function callingAt(day: SessionDay, e: Station, t: number): boolean {
  return e.open && !pausedAt(day, e, t);
}

/**
 * A pausa da etapa (a atual ou a próxima a partir de `now`): quando todas as estações abertas da etapa estão em
 * pausa, ninguém chama. `from` é quando a última delas pausou; `until`, quando a primeira volta (nulo, sem hora
 * de volta). Sem estação aberta não há pausa (a etapa está fechada).
 */
export function stagePause(day: SessionDay, stage: Stage, now: number): Pause | null {
  const stations = day.stations.filter((e) => serves(day, e, stage));
  if (stations.length === 0) return null;
  const starts = stations.flatMap((e) => intervals(day, e).map((i) => i.start)).filter((t) => t > now);
  for (const t of [now, ...[...new Set(starts)].sort((a, b) => a - b)]) {
    if (!stations.every((e) => pausedAt(day, e, t))) continue;
    const from = Math.max(...stations.map((e) => covering(day, e, t)?.start ?? t));
    const until = Math.min(...stations.map((e) => resumesAt(day, e, t)));
    return { from, until: until === NEVER ? null : until };
  }
  return null;
}

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
  if (e.calledItemId !== null) return failure("station_has_call");
  const deadline = (day.config.arrivalDeadlineMin ?? DEFAULT_CONFIG.arrivalDeadlineMin) * MIN;
  const onTheWay = onTheWayUntil(day, e.stage, now);
  // A pausa marcada ou em curso mantém o início; a que já acabou dá lugar a uma nova.
  const current = e.pause && (e.pause.until === null || e.pause.until > now) ? e.pause : null;
  const from = current?.from ?? (onTheWay === null ? now : Math.max(now + deadline, onTheWay));
  const back = cmd.back;
  const until = back === null ? null : "at" in back ? back.at : from + back.inMin * MIN;
  if (until !== null && !(Number.isFinite(until) && until > from)) return failure("pause_back_before_start");
  return ok(withStation(day, { ...e, pause: { from, until } }));
}

/** "Voltar agora" (em pausa) ou "desmarcar a pausa" (ainda não começou): a estação volta a chamar. */
export function resumeStation(day: SessionDay, cmd: Cmd, now: number): Result<SessionDay> {
  if (day.state !== "open") return failure("session_closed");
  const e = day.stations.find((x) => x.id === cmd.stationId);
  if (!e?.pause) return failure("forbidden_transition");
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
