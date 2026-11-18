import type { CallInTv } from "@fila-saude/schemas/tv";

/** RN-TV-07: o que já foi visto, o que espera para ser anunciado e o anúncio em destaque. */
export type Announcements = {
  started: boolean;
  seen: string[];
  queue: CallInTv[];
  current: { call: CallInTv; until: number } | null;
};

export const EMPTY_ANNOUNCEMENTS: Announcements = { started: false, seen: [], queue: [], current: null };

const SEEN_LIMIT = 50;

/**
 * Junta as chamadas da última leitura. Na primeira, só guarda o histórico (não anuncia o que já passou).
 * As novas entram na fila da mais antiga para a mais nova; rechamar gera uma chamada nova (outro horário).
 */
export function receiveCalls(
  e: Announcements,
  calls: CallInTv[],
  now = Number.POSITIVE_INFINITY,
  maxDelayMs = Number.POSITIVE_INFINITY,
): Announcements {
  const ids = calls.map((c) => c.id);
  if (!e.started) return { ...e, started: true, seen: ids };
  const fresh = calls.filter((c) => !e.seen.includes(c.id)).sort((a, b) => a.at.localeCompare(b.at));
  if (fresh.length === 0) return e;
  // Depois de uma queda, as chamadas que passaram há muito tempo só vão para o histórico.
  const recent = fresh.filter((c) => now - Date.parse(c.at) <= maxDelayMs);
  return {
    ...e,
    seen: [...fresh.map((c) => c.id), ...e.seen].slice(0, SEEN_LIMIT),
    queue: [...e.queue, ...recent],
  };
}

/** "Últimas chamadas": as já anunciadas (nem na fila de anúncios, nem a do destaque). */
export function lastAnnounced(e: Announcements, calls: CallInTv[]): CallInTv[] {
  const pending = new Set([...e.queue.map((c) => c.id), ...(e.current ? [e.current.call.id] : [])]);
  return calls.filter((c) => !pending.has(c.id));
}

/** Cada anúncio fica `highlightMs` em destaque; ao trocar, a TV toca o aviso (RN-TV-04). */
export function advanceAnnouncements(
  e: Announcements,
  now: number,
  highlightMs: number,
): { state: Announcements; tap: boolean } {
  if (e.current && now < e.current.until) return { state: e, tap: false };
  const [next, ...rest] = e.queue;
  if (!next) return { state: e.current ? { ...e, current: null } : e, tap: false };
  return { state: { ...e, queue: rest, current: { call: next, until: now + highlightMs } }, tap: true };
}
