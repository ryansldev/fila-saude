import type { SessionDay, Stage, Station } from "./queue.ts";

/**
 * Leitura das pausas no tempo (RN-EST-06, RN-SES-06), sem nada de `queue.ts` em tempo de execução: `outage.ts`
 * e `call.ts` usam isto, e `queue.ts` importa `outage.ts`.
 */

/** Uma pausa: desde `from`; `until` nulo, sem hora de volta. */
export type Pause = { from: number; until: number | null };

const NEVER = Number.POSITIVE_INFINITY;

const serves = (day: SessionDay, e: Station, stage: Stage) =>
  e.open && e.stage === stage && e.services.includes(day.serviceId);

/** Intervalos em que a estação não chama: a pausa dela e as pausas planejadas da sessão (vão entre faixas). */
function intervals(day: SessionDay, e: Station): { start: number; end: number }[] {
  const own = e.pause ? [{ start: e.pause.from, end: e.pause.until ?? NEVER }] : [];
  return [...own, ...(day.breaks ?? []).map((b) => ({ start: b.start, end: b.end }))];
}

const covering = (day: SessionDay, e: Station, t: number) => intervals(day, e).find((i) => i.start <= t && t < i.end);

/** Uma pausa planejada da sessão (vão entre faixas) cobre `t`. */
export const inBreak = (day: SessionDay, t: number) => (day.breaks ?? []).some((b) => b.start <= t && t < b.end);

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

/** Desde quando a estação está parada em `t` (pausas emendadas contam juntas); `t` se não está. */
function pausedSince(day: SessionDay, e: Station, t: number): number {
  const all = intervals(day, e);
  let r = covering(day, e, t)?.start ?? t;
  for (let guard = 0; guard < 50; guard++) {
    const prev = all.find((i) => i.start < r && i.end >= r);
    if (!prev) return r;
    r = prev.start;
  }
  return r;
}

/** A estação está em pausa em `t` (a dela ou a planejada da sessão). */
export function pausedAt(day: SessionDay, e: Station, t: number): boolean {
  return covering(day, e, t) !== undefined;
}

/** A estação chama em `t`: aberta (não fechada) e fora de pausa. */
export function callingAt(day: SessionDay, e: Station, t: number): boolean {
  return e.open && !pausedAt(day, e, t);
}

/** Desde quando a estação chama de novo em `t`: o fim da última pausa (dela ou da sessão), a volta ou a reabertura. */
export function resumedAt(day: SessionDay, e: Station, t: number): number {
  const ends = [...intervals(day, e).map((i) => i.end), e.callingSince ?? Number.NEGATIVE_INFINITY];
  return Math.max(Number.NEGATIVE_INFINITY, ...ends.filter((end) => end <= t));
}

/** A estação vai parar sem hora de volta (em pausa agora ou marcada): não conta na capacidade da fila. */
export function stopsForGood(e: Station): boolean {
  return e.pause !== undefined && e.pause.until === null;
}

/**
 * A pausa da etapa (a atual ou a próxima a partir de `now`): quando todas as estações abertas da etapa estão em
 * pausa, ninguém chama. `from` é quando a última delas parou (contando pausas emendadas); `until`, quando a
 * primeira volta (nulo, sem hora de volta). Sem estação aberta não há pausa (a etapa está fechada).
 */
export function stagePause(day: SessionDay, stage: Stage, now: number): Pause | null {
  const stations = day.stations.filter((e) => serves(day, e, stage));
  if (stations.length === 0) return null;
  const starts = stations.flatMap((e) => intervals(day, e).map((i) => i.start)).filter((t) => t > now);
  for (const t of [now, ...[...new Set(starts)].sort((a, b) => a - b)]) {
    if (!stations.every((e) => pausedAt(day, e, t))) continue;
    const from = Math.max(...stations.map((e) => pausedSince(day, e, t)));
    const until = Math.min(...stations.map((e) => resumesAt(day, e, t)));
    return { from, until: until === NEVER ? null : until };
  }
  return null;
}
