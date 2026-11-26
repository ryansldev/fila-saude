import { applyTransition, PAUSE_TRANSITIONS, type PauseState } from "./contracts.ts";
import type { QueueItem, SessionDay, Stage, Station } from "./queue.ts";
import type { Event } from "./result.ts";

/**
 * A pausa da estação como máquina de estados (RN-EST-06/07, `PAUSE_TRANSITIONS`): sem pausa, marcada ou em
 * pausa. As transições por tempo acontecem só em `advance`; o resto do domínio lê o estado que ela devolve
 * (nunca compara horários da pausa por conta própria). Sem nada de `queue.ts` em tempo de execução:
 * `outage.ts` e `call.ts` usam isto, e `queue.ts` importa `outage.ts`.
 */

/**
 * A pausa da etapa, para a estimativa: desde `from`; `until` nulo, sem hora de volta. `beforeTurn`: a pessoa
 * chegou no prazo e a estação pausou antes de chamá-la (opção C, com a justificativa).
 */
export type Pause = { from: number; until: number | null; beforeTurn?: true };

type Interval = { start: number; end: number };

const NEVER = Number.POSITIVE_INFINITY;

export const pauseState = (e: Station): PauseState => e.pause?.state ?? "none";

/** Confere a transição na tabela (transição não listada é erro de programação). */
export function move(e: Station, event: string): void {
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

type OwnPause = NonNullable<Station["pause"]>;

const serves = (day: SessionDay, e: Station, stage: Stage) =>
  e.open && e.stage === stage && e.services.includes(day.serviceId);

/** Opção C: de `ids`, quem está na unidade esperando a etapa da estação (não foi chamado nem saiu). */
export function waitingIn(day: SessionDay, e: Station, ids: readonly string[]): QueueItem[] {
  const set = new Set(ids);
  return day.items.filter((i) => set.has(i.id) && i.state === "present" && i.stage === e.stage);
}

/**
 * Pelo estado gravado, a estação vai chamar: sem pausa, ou em pausa com a volta já passada. Com a pausa marcada à
 * frente, só se `ahead` (para a justificativa: ela ainda chama agora); para a pergunta não conta, porque pode
 * parar antes de chegar a quem espera.
 */
function callingStored(x: Station, now: number, ahead: boolean): boolean {
  const p = x.pause;
  if (!p) return true;
  if (p.state === "scheduled") return ahead && p.from > now;
  // Em pausa com a volta já passada (a varredura ainda não gravou): já voltou a chamar.
  return p.state === "paused" && p.until !== null && p.until <= now;
}

/**
 * Outra estação da etapa vai chamar quem espera, fora do intervalo da sessão (`callingStored`). Lê o estado
 * gravado, sem `advance`, para não andar em círculo entre estações.
 */
export function othersCalling(day: SessionDay, e: Station, now: number, ahead = false): boolean {
  if (inBreak(day, now)) return false;
  return day.stations.some((x) => x.id !== e.id && serves(day, x, e.stage) && callingStored(x, now, ahead));
}

/**
 * Guarda quem recebeu a justificativa (opção C), de qual estação e de qual parada dela (`since`: o início da
 * pausa, ou a hora em que fechou).
 */
export function withHeld(day: SessionDay, notices: Event[], since: number): SessionDay {
  const added = notices.flatMap((n) =>
    n.itemId && n.stationId ? [{ id: n.itemId, stationId: n.stationId, since }] : [],
  );
  if (added.length === 0) return day;
  return { ...day, heldByPause: [...(day.heldByPause ?? []), ...added] };
}

/** A primeira volta das outras estações da etapa (em pausa ou perguntando, com hora); nulo sem nenhuma. */
function othersReturn(day: SessionDay, e: Station): number | null {
  const backs = day.stations.flatMap((x) =>
    x.id !== e.id && serves(day, x, e.stage) && (x.pause?.state === "paused" || x.pause?.state === "asking")
      ? x.pause.until === null
        ? []
        : [x.pause.until]
      : [],
  );
  return backs.length > 0 ? Math.min(...backs) : null;
}

const earliest = (a: number | null, b: number | null) => (a === null ? b : b === null ? a : Math.min(a, b));

/**
 * A pausa que segura a pessoa (opção C): a mesma parada (pausa ou fechamento) da estação que mandou a
 * justificativa, enquanto nenhuma outra estação da etapa chama. A volta é a primeira da etapa: a desta estação (em
 * pausa) ou a de outra; sem nenhuma, sem hora. Nulo se nada a segura.
 */
export function heldPause(day: SessionDay, itemId: string, now: number): Pause | null {
  for (const h of day.heldByPause ?? []) {
    if (h.id !== itemId) continue;
    const e = day.stations.find((x) => x.id === h.stationId);
    if (!e || othersCalling(day, e, now, true)) continue;
    if (!e.open && e.closedAt === h.since) return { from: h.since, until: othersReturn(day, e), beforeTurn: true };
    if (e.open && e.pause?.state === "paused" && e.pause.since === h.since)
      return { from: h.since, until: earliest(e.pause.until, othersReturn(day, e)), beforeTurn: true };
  }
  return null;
}

/** Quem a pausa segura agora (`heldPause`). */
export function heldNow(day: SessionDay, now: number): Set<string> {
  return new Set((day.heldByPause ?? []).filter((h) => heldPause(day, h.id, now) !== null).map((h) => h.id));
}

/** A justificativa (opção C) para quem esperava; nada se outra estação da etapa vai chamá-los. */
export function pauseNotices(day: SessionDay, e: Station, until: number | null, now: number): Event[] {
  const p = e.pause;
  if ((p?.state !== "asking" && p?.state !== "serving") || othersCalling(day, e, now, true)) return [];
  // Quem já recebeu a justificativa (de outra estação, ou ao fechar) não recebe de novo.
  const held = heldNow(day, now);
  const who = waitingIn(day, e, p.waitFor).filter((i) => !held.has(i.id));
  // Só a única pessoa segurada pela pausa na etapa ouve que é a primeira na volta.
  const heldHere = day.items.some((i) => held.has(i.id) && i.state === "present" && i.stage === e.stage);
  // A volta que a pessoa ouve é a primeira da etapa, a mesma que o app mostra (`heldPause`).
  const back = earliest(until, othersReturn(day, e));
  return who.map((i) => turnAfterPause(day, e, i, back, now, who.length === 1 && !heldHere));
}

function turnAfterPause(
  day: SessionDay,
  e: Station,
  i: QueueItem,
  until: number | null,
  now: number,
  first: boolean,
): Event {
  return {
    kind: "turn_after_pause",
    itemId: i.id,
    entryId: i.entryId,
    sessionId: day.sessionId,
    stationId: e.id,
    data: { until, at: now, stage: i.stage, first },
  };
}

/**
 * Quem saiu da chamada (atendido, acolhido ou não compareceu) não segura mais nenhuma pausa (opção C): sai das
 * listas de espera.
 */
export function dropWaiting(day: SessionDay, itemId: string): SessionDay {
  const without = (e: Station): Station => {
    const p = e.pause;
    if (p?.state === "scheduled" && p.waitFor?.some((w) => w.id === itemId))
      return { ...e, pause: { ...p, waitFor: p.waitFor.filter((w) => w.id !== itemId) } };
    if ((p?.state === "asking" || p?.state === "serving") && p.waitFor.includes(itemId))
      return { ...e, pause: { ...p, waitFor: p.waitFor.filter((id) => id !== itemId) } };
    return e;
  };
  const stations = day.stations.map(without);
  return stations.some((e, k) => e !== day.stations[k]) ? { ...day, stations } : day;
}

/**
 * Fechar a estação (opção C): quem esperava a pergunta ou o atendimento antes, e quem já tinha a justificativa
 * desta pausa (com a hora de volta, que não vale mais), recebe a justificativa com a volta de outra estação da
 * etapa, ou sem hora.
 */
export function closeNotices(day: SessionDay, e: Station, now: number): Event[] {
  const p = e.pause;
  // Fechada, a volta que vale é a de outra estação da etapa (se houver).
  const until = othersReturn(day, e);
  if (p?.state !== "paused") return pauseNotices(day, e, until, now);
  if (othersCalling(day, e, now, true)) return [];
  const mine = new Set(
    (day.heldByPause ?? []).filter((h) => h.stationId === e.id && h.since === p.since).map((h) => h.id),
  );
  const who = day.items.filter((i) => mine.has(i.id) && i.state === "present" && i.stage === e.stage);
  const held = heldNow(day, now);
  const heldElsewhere = day.items.some(
    (i) => held.has(i.id) && !mine.has(i.id) && i.state === "present" && i.stage === e.stage,
  );
  return who.map((i) => turnAfterPause(day, e, i, until, now, who.length === 1 && !heldElsewhere));
}

/** Quem da lista da pausa marcada chegou no próprio prazo (e antes da hora da pausa) e espera; atrasado não entra. */
function arrivedInTime(day: SessionDay, e: Station, p: Extract<OwnPause, { state: "scheduled" }>): string[] {
  const by = new Map((p.waitFor ?? []).map((w) => [w.id, w.by]));
  return waitingIn(day, e, [...by.keys()])
    .filter((i) => i.presentSince != null && i.presentSince <= Math.min(p.from, by.get(i.id) ?? p.from))
    .map((i) => i.id);
}

/**
 * O relógio da pausa: aplica as transições por tempo (e pelo estado da fila) até `now`.
 * - Marcada, na hora e com a estação livre: desde a hora marcada, ou desde agora se o atendimento acabou de
 *   terminar (`callEnded`). Se a volta passou durante o atendimento, a pausa não aconteceu. Com alguém que estava
 *   a caminho esperando (chegou no prazo) e nenhuma outra estação da etapa chamando, pergunta (opção C); senão,
 *   entra em pausa.
 * - Perguntando: sem mais ninguém esperando, entra em pausa (desde quando passou a perguntar); na hora da volta, sai.
 * - Atendendo antes: só ao fim do atendimento (`callEnded`), pergunta de novo se ainda há alguém esperando, ou
 *   entra em pausa; a volta anda (a mesma duração, contada de agora).
 * - Em pausa, na hora da volta, sai: a pausa vira parada no histórico, e o silêncio de antes não é queda.
 * Com paciente chamado, a marcada espera (a estação ainda atende).
 */
export function advance(day: SessionDay, e: Station, now: number, callEnded = false): Station {
  let s = e;
  for (let guard = 0; guard < 4; guard++) {
    const p = s.pause;
    if (!p) return s;
    if (p.state === "scheduled") {
      if (now < p.from || s.calledItemId !== null) return s;
      const since = callEnded ? now : p.from;
      if (p.until !== null && p.until <= since) {
        move(s, "A volta passa durante o atendimento");
        return withoutPause(s);
      }
      const waitFor = arrivedInTime(day, s, p);
      if (waitFor.length > 0 && !othersCalling(day, s, now)) {
        move(s, "Hora da pausa com quem chegou no prazo esperando");
        // Segue: a hora da volta pode já ter passado (a varredura viu tarde).
        s = { ...s, pause: { state: "asking", since, askedAt: now, until: p.until, waitFor } };
        continue;
      }
      move(s, "Hora da pausa com a estação livre");
      s = { ...s, pause: { state: "paused", since, until: p.until } };
      continue;
    }
    if (p.state === "serving") {
      // Livre: o atendimento antes terminou (pelas ações, ou por outro caminho que tirou a chamada).
      if (s.calledItemId !== null) return s;
      const until = p.length === null ? null : now + p.length;
      if (waitingIn(day, s, p.waitFor).length > 0 && !othersCalling(day, s, now)) {
        move(s, "Fim do atendimento com mais alguém esperando");
        return { ...s, pause: { state: "asking", since: now, askedAt: now, until, waitFor: p.waitFor } };
      }
      move(s, "Fim do atendimento sem mais ninguém esperando");
      s = { ...s, pause: { state: "paused", since: now, until } };
      continue;
    }
    if (p.until !== null && now >= p.until) {
      move(s, "Hora da volta");
      const back = p.until;
      return {
        ...withoutPause(s),
        ...withStop(s, { start: p.since, end: back }),
        callingSince: Math.max(s.callingSince ?? back, back),
      };
    }
    if (p.state === "asking" && waitingIn(day, s, p.waitFor).length === 0) {
      move(s, "Ninguém mais esperando");
      s = { ...s, pause: { state: "paused", since: p.since, until: p.until } };
      continue;
    }
    return s;
  }
  return s;
}

/** O relógio de todas as estações (as ações da estação e a varredura gravam o estado do momento). */
export function advancePauses(day: SessionDay, now: number): SessionDay {
  let changed = false;
  const stations = day.stations.map((e) => {
    const next = advance(day, e, now);
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
  // Em pausa ou perguntando, a estação não chamava: vira parada. Marcada ou atendendo antes, não parou.
  const stop = p.state === "paused" || p.state === "asking" ? { start: p.since, end: now } : undefined;
  return { ...withoutPause(e), ...withStop(e, stop) };
}

/** Uma pausa planejada da sessão (vão entre faixas) cobre `t`. */
export const inBreak = (day: SessionDay, t: number) => (day.breaks ?? []).some((b) => b.start <= t && t < b.end);

const breaks = (day: SessionDay): Interval[] => (day.breaks ?? []).map((b) => ({ start: b.start, end: b.end }));

/**
 * Quando a estação não chama, visto em `at`: as paradas encerradas, a pausa dela (em pausa ou perguntando; ou
 * marcada, desde a hora marcada: com paciente em atendimento ela começa ao fim dele, mas ninguém mais é chamado
 * antes) e as pausas planejadas da sessão. Atendendo antes (opção C), a pausa começa quando o atendimento acabar:
 * no previsto (`from`), ou desde `origin` (o agora de quem pergunta) se ele passou, com a mesma duração.
 */
function timeline(day: SessionDay, e: Station, at: number, withBreaks = true, origin = at): Interval[] {
  const s = advance(day, e, at);
  const own = ownInterval(s.pause, origin);
  return [...(s.stops ?? []), ...(own ? [own] : []), ...(withBreaks ? breaks(day) : [])];
}

function ownInterval(p: OwnPause | undefined, origin: number): Interval | null {
  if (!p) return null;
  switch (p.state) {
    case "scheduled":
      return { start: p.from, end: p.until ?? NEVER };
    case "serving": {
      // Previsto para o fim do atendimento; se ele passa da previsão, a pausa segue à frente, contada de agora.
      const start = Math.max(p.from, origin);
      return { start, end: p.length === null ? NEVER : start + p.length };
    }
    default:
      return { start: p.since, end: p.until ?? NEVER };
  }
}

const covering = (list: Interval[], t: number) => list.find((i) => i.start <= t && t < i.end);

/** A estação não chama em `t`: em pausa, perguntando (opção C) ou no intervalo da sessão. */
export function pausedAt(day: SessionDay, e: Station, t: number): boolean {
  const state = pauseState(advance(day, e, t));
  return state === "paused" || state === "asking" || inBreak(day, t);
}

/** A estação chama em `t`: aberta e fora de pausa; com paciente em atendimento, ainda não parou. */
export function callingAt(day: SessionDay, e: Station, t: number): boolean {
  return e.open && (e.calledItemId !== null || !pausedAt(day, e, t));
}

/** Desde quando a estação chama de novo em `t`: o fim da última parada (dela ou da sessão), a volta ou a reabertura. */
export function resumedAt(day: SessionDay, e: Station, t: number): number {
  const s = advance(day, e, t);
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

/**
 * A estação para sem hora de volta até `by` (em pausa ou perguntando, ou marcada para antes): não conta na
 * capacidade. Atendendo antes de pausar, ainda atende.
 */
export function stopsForGood(e: Station, by: number): boolean {
  const p = e.pause;
  if (!p || p.state === "serving" || p.until !== null) return false;
  return p.state !== "scheduled" || p.from <= by;
}

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
 * primeira volta (nulo, sem hora de volta). Sem estação aberta não há pausa (a etapa está fechada). `origin`: o
 * agora real, quando `now` é um instante à frente na conta da espera (a pausa de quem atende antes conta dele).
 */
export function stagePause(day: SessionDay, stage: Stage, now: number, origin = now): Pause | null {
  const stations = day.stations.filter((e) => serves(day, e, stage));
  if (stations.length === 0) return null;
  const lists = stations.map((e) => timeline(day, e, now, true, origin));
  const starts = lists.flatMap((l) => l.map((i) => i.start)).filter((t) => t > now);
  for (const t of [now, ...[...new Set(starts)].sort((a, b) => a - b)]) {
    if (!lists.every((l) => covering(l, t) !== undefined)) continue;
    const from = Math.max(...lists.map((l) => pausedSince(l, t)));
    const until = Math.min(...lists.map((l) => resumesAt(l, t)));
    return { from, until: until === NEVER ? null : until };
  }
  return null;
}
