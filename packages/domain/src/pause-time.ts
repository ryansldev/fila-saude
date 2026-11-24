import { applyTransition, PAUSE_TRANSITIONS, type PauseState } from "./contracts.ts";
import type { SessionDay, Stage, Station } from "./queue.ts";

/**
 * A pausa da estação como máquina de estados (RN-EST-06/07, `PAUSE_TRANSITIONS`): sem pausa, marcada ou em
 * pausa. As transições por tempo acontecem só em `advance`; o resto do domínio lê o estado que ela devolve
 * (nunca compara horários da pausa por conta própria). Sem nada de `queue.ts` em tempo de execução:
 * `outage.ts` e `call.ts` usam isto, e `queue.ts` importa `outage.ts`.
 */

/** A pausa da etapa, para a estimativa: desde `from`; `until` nulo, sem hora de volta. */
export type Pause = { from: number; until: number | null };

type Interval = { start: number; end: number };

const NEVER = Number.POSITIVE_INFINITY;

export const pauseState = (e: Station): PauseState => e.pause?.state ?? "none";

/** Confere a transição na tabela (transição não listada é erro de programação). */
function move(e: Station, event: string): void {
  if (applyTransition(PAUSE_TRANSITIONS, pauseState(e), event) === null) {
    throw new Error(`contrato da pausa: "${event}" não sai de ${pauseState(e)}`);
  }
}

/** Guarda uma parada encerrada (pausa ou tempo fechada) no histórico da estação. */
export function withStop(e: Station, stop: Interval | undefined): Pick<Station, "stops"> {
  if (!stop || stop.end <= stop.start) return e.stops ? { stops: e.stops } : {};
  return { stops: [...(e.stops ?? []), stop] };
}

const withoutPause = (e: Station): Station => {
  const { pause: _, ...rest } = e;
  return rest;
};

/**
 * O relógio da pausa: aplica as transições por tempo até `now`.
 * - Marcada, na hora e com a estação livre, entra em pausa: desde a hora marcada, ou desde agora se o
 *   atendimento acabou de terminar (`callEnded`). Se a volta passou durante o atendimento, a pausa não aconteceu.
 * - Em pausa, na hora da volta, sai: a pausa vira parada no histórico, e o silêncio de antes não é queda.
 * Com paciente chamado, a marcada espera (a estação ainda atende).
 */
export function advance(e: Station, now: number, callEnded = false): Station {
  let s = e;
  for (let guard = 0; guard < 3; guard++) {
    const p = s.pause;
    if (!p) return s;
    if (p.state === "scheduled") {
      if (now < p.from || s.calledItemId !== null) return s;
      const since = callEnded ? now : p.from;
      if (p.until !== null && p.until <= since) {
        move(s, "A volta passa durante o atendimento");
        return withoutPause(s);
      }
      move(s, "Hora da pausa com a estação livre");
      s = { ...s, pause: { state: "paused", since, until: p.until } };
      continue;
    }
    if (p.until === null || now < p.until) return s;
    move(s, "Hora da volta");
    const back = p.until;
    return {
      ...withoutPause(s),
      ...withStop(s, { start: p.since, end: back }),
      callingSince: Math.max(s.callingSince ?? back, back),
    };
  }
  return s;
}

/** O relógio de todas as estações (as ações da estação e a varredura gravam o estado do momento). */
export function advancePauses(day: SessionDay, now: number): SessionDay {
  let changed = false;
  const stations = day.stations.map((e) => {
    const next = advance(e, now);
    if (next !== e) changed = true;
    return next;
  });
  return changed ? { ...day, stations } : day;
}

/** Sair da pausa por ação: "Voltar agora", "Desmarcar a pausa" ou "Fechar a estação". */
export function leavePause(e: Station, event: "Voltar agora" | "Desmarcar a pausa" | "Fechar a estação", now: number) {
  const p = e.pause;
  if (!p) return e;
  move(e, event);
  const stop = p.state === "paused" ? { start: p.since, end: now } : undefined;
  return { ...withoutPause(e), ...withStop(e, stop) };
}

/** Uma pausa planejada da sessão (vão entre faixas) cobre `t`. */
export const inBreak = (day: SessionDay, t: number) => (day.breaks ?? []).some((b) => b.start <= t && t < b.end);

const breaks = (day: SessionDay): Interval[] => (day.breaks ?? []).map((b) => ({ start: b.start, end: b.end }));

/**
 * Quando a estação não chama, visto em `at`: as paradas encerradas, a pausa dela (em pausa, ou marcada, que
 * começa na hora ou ao fim do atendimento em curso) e as pausas planejadas da sessão.
 */
function timeline(day: SessionDay, e: Station, at: number, withBreaks = true): Interval[] {
  const s = advance(e, at);
  const p = s.pause;
  const own: Interval[] = !p
    ? []
    : p.state === "paused"
      ? [{ start: p.since, end: p.until ?? NEVER }]
      : [{ start: s.calledItemId !== null ? Math.max(p.from, at) : p.from, end: p.until ?? NEVER }];
  return [...(s.stops ?? []), ...own, ...(withBreaks ? breaks(day) : [])];
}

const covering = (list: Interval[], t: number) => list.find((i) => i.start <= t && t < i.end);

/** A estação está em pausa em `t` (a dela ou a planejada da sessão). */
export function pausedAt(day: SessionDay, e: Station, t: number): boolean {
  return pauseState(advance(e, t)) === "paused" || inBreak(day, t);
}

/** A estação chama em `t`: aberta e fora de pausa; com paciente em atendimento, ainda não parou. */
export function callingAt(day: SessionDay, e: Station, t: number): boolean {
  return e.open && (e.calledItemId !== null || !pausedAt(day, e, t));
}

/** Desde quando a estação chama de novo em `t`: o fim da última parada (dela ou da sessão), a volta ou a reabertura. */
export function resumedAt(day: SessionDay, e: Station, t: number): number {
  const s = advance(e, t);
  const ends = [...(s.stops ?? []), ...breaks(day)].map((i) => i.end).filter((end) => end <= t);
  return Math.max(Number.NEGATIVE_INFINITY, s.callingSince ?? Number.NEGATIVE_INFINITY, ...ends);
}

/** Quanto de [a, b] a estação passou parada (pausas e tempo fechada; as da sessão só com `withBreaks`), em ms. */
export function pausedBetween(
  day: SessionDay,
  e: Station | undefined,
  a: number,
  b: number,
  withBreaks = true,
): number {
  const own = e ? timeline(day, e, b, withBreaks) : withBreaks ? breaks(day) : [];
  // Fechada e ainda não reaberta: o tempo fechada até `b` também não é atendimento.
  const closed = e?.closedAt !== undefined ? [{ start: e.closedAt, end: b }] : [];
  const cut = [...own, ...closed]
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

/** A estação para sem hora de volta até `by` (em pausa, ou marcada para antes): não conta na capacidade. */
export function stopsForGood(e: Station, by: number): boolean {
  const p = e.pause;
  if (!p || p.until !== null) return false;
  return p.state === "paused" || p.from <= by;
}

const serves = (day: SessionDay, e: Station, stage: Stage) =>
  e.open && e.stage === stage && e.services.includes(day.serviceId);

/** Quando a estação volta a chamar depois de `t` (paradas emendadas contam juntas); `NEVER` sem hora de volta. */
function resumesAt(list: Interval[], t: number): number {
  let r = t;
  for (let guard = 0; guard < 50; guard++) {
    const c = covering(list, r);
    if (!c) return r;
    if (c.end === NEVER) return NEVER;
    r = c.end;
  }
  return r;
}

/** Desde quando a estação está parada em `t` (paradas emendadas contam juntas); `t` se não está. */
function pausedSince(list: Interval[], t: number): number {
  let r = covering(list, t)?.start ?? t;
  for (let guard = 0; guard < 50; guard++) {
    const prev = list.find((i) => i.start < r && i.end >= r);
    if (!prev) return r;
    r = prev.start;
  }
  return r;
}

/**
 * A pausa da etapa (a atual ou a próxima a partir de `now`): quando todas as estações abertas da etapa estão
 * paradas, ninguém chama. `from` é quando a última delas parou (contando paradas emendadas); `until`, quando a
 * primeira volta (nulo, sem hora de volta). Sem estação aberta não há pausa (a etapa está fechada).
 */
export function stagePause(day: SessionDay, stage: Stage, now: number): Pause | null {
  const stations = day.stations.filter((e) => serves(day, e, stage));
  if (stations.length === 0) return null;
  const lists = stations.map((e) => timeline(day, e, now));
  const starts = lists.flatMap((l) => l.map((i) => i.start)).filter((t) => t > now);
  for (const t of [now, ...[...new Set(starts)].sort((a, b) => a - b)]) {
    if (!lists.every((l) => covering(l, t) !== undefined)) continue;
    const from = Math.max(...lists.map((l) => pausedSince(l, t)));
    const until = Math.min(...lists.map((l) => resumesAt(l, t)));
    return { from, until: until === NEVER ? null : until };
  }
  return null;
}
