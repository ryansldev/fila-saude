import type { QueueItem, SessionDay, Stage, Station } from "./queue.ts";

/**
 * Leitura das pausas no tempo (RN-EST-06, RN-SES-06), sem nada de `queue.ts` em tempo de execução: `outage.ts`
 * e `call.ts` usam isto, e `queue.ts` importa `outage.ts`.
 */

/** Uma pausa: desde `from`; `until` nulo, sem hora de volta. */
export type Pause = { from: number; until: number | null };

const NEVER = Number.POSITIVE_INFINITY;

const serves = (day: SessionDay, e: Station, stage: Stage) =>
  e.open && e.stage === stage && e.services.includes(day.serviceId);

/**
 * Intervalos em que a estação não chama: as paradas já encerradas, a pausa dela e as pausas planejadas da
 * sessão (vão entre faixas).
 */
function intervals(day: SessionDay, e: Station, forCalls = false): { start: number; end: number }[] {
  // Adiada (atender antes de pausar): a estação ainda chama, mas a fila de casa já conta com a pausa.
  const own = e.pause && !(forCalls && e.pause.deferred) ? [{ start: e.pause.from, end: e.pause.until ?? NEVER }] : [];
  return [...(e.stops ?? []), ...own, ...(day.breaks ?? []).map((b) => ({ start: b.start, end: b.end }))];
}

const covering = (day: SessionDay, e: Station, t: number, forCalls = false) =>
  intervals(day, e, forCalls).find((i) => i.start <= t && t < i.end);

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

/** Quanto de [a, b] a estação passou parada (pausas, tempo fechada e as pausas da sessão), em ms. */
export function pausedBetween(day: SessionDay, e: Station | undefined, a: number, b: number): number {
  // Fechada e ainda não reaberta: o tempo fechada até `b` também não é atendimento.
  const closed = e?.closedAt !== undefined ? [{ start: e.closedAt, end: b }] : [];
  const all = e ? intervals(day, e, true) : (day.breaks ?? []);
  const cut = [...all, ...closed]
    .map((i) => ({ start: Math.max(i.start, a), end: Math.min(i.end, b) }))
    .filter((i) => i.end > i.start)
    .sort((x, y) => x.start - y.start);
  let total = 0;
  let cursor = a;
  for (const i of cut) {
    const start = Math.max(i.start, cursor);
    if (i.end > start) total += i.end - start;
    cursor = Math.max(cursor, i.end);
  }
  return total;
}

/** A estação está em pausa em `t` (a dela ou a planejada da sessão). */
export function pausedAt(day: SessionDay, e: Station, t: number): boolean {
  return covering(day, e, t, true) !== undefined;
}

/** A estação chama em `t`: aberta (não fechada) e fora de pausa. */
export function callingAt(day: SessionDay, e: Station, t: number): boolean {
  return e.open && !pausedAt(day, e, t);
}

/** Desde quando a estação chama de novo em `t`: o fim da última pausa (dela ou da sessão), a volta ou a reabertura. */
export function resumedAt(day: SessionDay, e: Station, t: number): number {
  // A pausa adiada não parou a estação: não conta como volta.
  const ends = [...intervals(day, e, true).map((i) => i.end), e.callingSince ?? Number.NEGATIVE_INFINITY];
  return Math.max(Number.NEGATIVE_INFINITY, ...ends.filter((end) => end <= t));
}

/** A estação para sem hora de volta até `by` (em pausa ou marcada antes): não conta na capacidade da fila. */
export function stopsForGood(e: Station, by: number): boolean {
  return e.pause !== undefined && e.pause.until === null && e.pause.from <= by;
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
    // Conta também a pausa adiada (atender antes de pausar): a fila de casa já conta com ela.
    if (!stations.every((e) => covering(day, e, t) !== undefined)) continue;
    const from = Math.max(...stations.map((e) => pausedSince(day, e, t)));
    const until = Math.min(...stations.map((e) => resumesAt(day, e, t)));
    return { from, until: until === NEVER ? null : until };
  }
  return null;
}

/** Guarda uma parada encerrada (pausa ou tempo fechada) no histórico da estação. */
export function withStop(e: Station, stop: { start: number; end: number } | undefined): Pick<Station, "stops"> {
  if (!stop || stop.end <= stop.start) return e.stops ? { stops: e.stops } : {};
  return { stops: [...(e.stops ?? []), stop] };
}

/**
 * Opção C (AD-077): quem estava a caminho quando a pausa foi marcada, já chegou e ainda não foi chamado. Só
 * depois da hora da pausa (antes dela, a estação chama normalmente).
 */
export function waitingBeforePause(day: SessionDay, stationId: string, now: number): QueueItem[] {
  const e = day.stations.find((x) => x.id === stationId);
  const p = e?.pause;
  if (!e || !p?.waitFor || p.from > now) return [];
  const ids = new Set(p.waitFor);
  return day.items.filter((i) => ids.has(i.id) && i.state === "present" && i.stage === e.stage);
}

/**
 * A pausa adiada começa quando não há mais ninguém de `waitFor` esperando (o profissional finalizou): desde
 * agora, com a mesma duração (a volta anda o mesmo tanto).
 */
export function settleDeferredPause(day: SessionDay, stationId: string, now: number, force = false): SessionDay {
  const e = day.stations.find((x) => x.id === stationId);
  const p = e?.pause;
  if (!e || !p?.deferred || (!force && waitingBeforePause(day, stationId, now).length > 0)) return day;
  const pause = { from: now, until: p.until === null ? null : now + (p.until - p.from) };
  return { ...day, stations: day.stations.map((x) => (x.id === e.id ? { ...e, pause } : x)) };
}
