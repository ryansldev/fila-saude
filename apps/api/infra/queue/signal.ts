import { and, eq, isNotNull, isNull, lt, max, or } from "drizzle-orm";
import { service } from "infra/database/municipal/schema/service";
import { session, sessionStation } from "infra/database/municipal/schema/session";
import { station } from "infra/database/municipal/schema/station";
import { tv } from "infra/database/municipal/schema/tv";
import type { TenantDatabase } from "infra/database/tenants";

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

const latest = (...dates: (Date | null | undefined)[]): number | null => {
  const times = dates.filter((d): d is Date => d instanceof Date).map((d) => d.getTime());
  return times.length === 0 ? null : Math.max(...times);
};

/** O último sinal de vida da unidade da sessão (PV5 da AD-076): as TVs pareadas e as estações da sessão. */
export async function sessionSignal(db: TenantDatabase, sessionId: string): Promise<{ lastSignalAt: number | null }> {
  const [stations] = await db
    .select({ at: max(station.lastSignalAt) })
    .from(sessionStation)
    .innerJoin(station, eq(station.id, sessionStation.stationId))
    .where(and(eq(sessionStation.sessionId, sessionId), isNull(station.archivedAt)));
  const [tvs] = await db
    .select({ at: max(tv.lastSignalAt) })
    .from(session)
    .innerJoin(service, eq(service.id, session.serviceId))
    .innerJoin(tv, eq(tv.unitId, service.unitId))
    .where(and(eq(session.id, sessionId), isNull(tv.revokedAt), isNotNull(tv.pairedAt)));
  return { lastSignalAt: latest(stations?.at, tvs?.at) };
}
