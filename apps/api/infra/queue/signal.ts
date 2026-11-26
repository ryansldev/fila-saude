import { type SessionDay, signalAlerts } from "@fila-saude/domain";
import type { SignalAlertOutput } from "@fila-saude/schemas/unit";
import { and, asc, count, eq, isNotNull, isNull, lt, max, or } from "drizzle-orm";
import { requireUnit } from "infra/config/common";
import { service } from "infra/database/municipal/schema/service";
import { session, sessionStation } from "infra/database/municipal/schema/session";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import { station } from "infra/database/municipal/schema/station";
import { tv } from "infra/database/municipal/schema/tv";
import type { TenantDatabase } from "infra/database/tenants";
import type { ActionContext } from "infra/panel/action";
import { fromUnitStaff } from "infra/queue/panel";

/** Grava o sinal de vida no máximo a cada 20 s, como a TV (RN-TV-06). */
const SIGNAL_MS = 20_000;

/** RN-SES-05: a estação aberta no painel dá sinal de vida a cada leitura e a cada comando. */
export async function stationSignal(db: TenantDatabase, stationId: string, now: number): Promise<void> {
  await db
    .update(station)
    .set({ lastSignalAt: new Date(now) })
    .where(
      and(
        eq(station.id, stationId),
        or(isNull(station.lastSignalAt), lt(station.lastSignalAt, new Date(now - SIGNAL_MS))),
      ),
    );
}

const time = (d: Date | null | undefined): number | null => (d instanceof Date ? d.getTime() : null);

/**
 * O sinal de vida da unidade da sessão (PV5 da AD-076): se ela tem TV pareada, o último sinal das TVs e o
 * das estações da sessão. A regra de qual conta é do domínio (`trackOutage`).
 */
export async function sessionSignal(
  db: TenantDatabase,
  sessionId: string,
): Promise<{ hasTv: boolean; tvSignalAt: number | null; stationSignalAt: number | null }> {
  const [stations] = await db
    .select({ at: max(station.lastSignalAt) })
    .from(sessionStation)
    .innerJoin(station, eq(station.id, sessionStation.stationId))
    .where(and(eq(sessionStation.sessionId, sessionId), isNull(station.archivedAt)));
  const [tvs] = await db
    .select({ n: count(tv.id), at: max(tv.lastSignalAt) })
    .from(session)
    .innerJoin(service, eq(service.id, session.serviceId))
    .innerJoin(tv, eq(tv.unitId, service.unitId))
    .where(and(eq(session.id, sessionId), isNull(tv.revokedAt), isNotNull(tv.pairedAt)));
  return { hasTv: (tvs?.n ?? 0) > 0, tvSignalAt: time(tvs?.at), stationSignalAt: time(stations?.at) };
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * QP2 (AD-076): a TV e as estações sem sinal na unidade, para a faixa do painel, para quem tem ação da fila nela.
 * As TVs primeiro, depois as estações na ordem do cadastro. A regra de quem entra é do domínio (`signalAlerts`).
 */
export async function unitSignalAlerts(ctx: ActionContext, unitId: string): Promise<SignalAlertOutput[]> {
  await requireUnit(ctx.db, unitId);
  await fromUnitStaff(ctx, unitId);
  const open = await ctx.db
    .select({ start: session.start, end: session.end, day: sessionDay.day })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .innerJoin(sessionDay, eq(sessionDay.sessionId, session.id))
    .where(and(eq(service.unitId, unitId), eq(session.state, "open")));
  if (open.length === 0) return [];
  const tvs = await ctx.db
    .select({ id: tv.id, at: tv.lastSignalAt })
    .from(tv)
    .where(and(eq(tv.unitId, unitId), isNull(tv.revokedAt), isNotNull(tv.pairedAt)))
    .orderBy(asc(tv.pairedAt));
  const stations = await ctx.db
    .select({ id: station.id, name: station.name, at: station.lastSignalAt })
    .from(station)
    .where(and(eq(station.unitId, unitId), isNull(station.archivedAt)))
    .orderBy(asc(station.createdAt));
  const names = new Map(stations.map((e) => [e.id, e.name]));
  return signalAlerts({
    sessions: open.map((s) => ({ day: s.day as SessionDay, start: s.start.getTime(), end: s.end.getTime() })),
    tvs: tvs.map((t) => ({ id: t.id, signalAt: time(t.at) })),
    stations: stations.map((e) => ({ id: e.id, signalAt: time(e.at) })),
    now: ctx.now,
  }).map((a) => ({ kind: a.kind, id: a.id, name: names.get(a.id) ?? null, since: iso(a.since) }));
}
