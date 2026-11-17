import { randomBytes } from "node:crypto";
import {
  DEFAULT_CONFIG,
  type Entry,
  type Event,
  effectiveConfig,
  type Service,
  type SessionDay,
  type SessionSlots,
  type UnitConfig,
} from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { service } from "infra/database/municipal/schema/service";
import { session, sessionStation } from "infra/database/municipal/schema/session";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import { station, stationService } from "infra/database/municipal/schema/station";
import { unit } from "infra/database/municipal/schema/unit";
import type { TenantDatabase, TenantDb, TenantTx } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { saveNotices } from "infra/notices/outbox";
import { sessionEntries, updateEntry } from "./entries";

type SessionRow = typeof session.$inferSelect;
type ServiceRow = typeof service.$inferSelect;
type UnitRow = typeof unit.$inferSelect;

export const toSessionSlots = (s: SessionRow): SessionSlots => ({
  id: s.id,
  serviceId: s.serviceId,
  visibility: s.visibility,
  slots: s.slots,
  start: s.start.getTime(),
  taken: s.taken,
});

export const forService = (s: ServiceRow): Service => ({ id: s.id, mode: s.mode, requiresTriage: s.requiresTriage });

export const unitConfig = (u: UnitRow): UnitConfig => ({
  ...DEFAULT_CONFIG,
  ...effectiveConfig({ municipality: {}, unit: u.config }),
  timeZone: u.timeZone,
});

async function rows(db: TenantDatabase, sessionId: string, lock: boolean) {
  const q = db
    .select({ s: session, srv: service, u: unit })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .innerJoin(unit, eq(service.unitId, unit.id))
    .where(eq(session.id, sessionId));
  const [row] = lock ? await q.for("update", { of: session }) : await q;
  if (!row) throw new ApiError(404, "not_found");
  return row;
}

export async function readDay(db: TenantDatabase, sessionId: string): Promise<SessionDay | null> {
  const [row] = await db.select().from(sessionDay).where(eq(sessionDay.sessionId, sessionId));
  return row?.day ?? null;
}

// PD-44: o dia de uma sessão planejada é montado na hora: serviço, estações da sessão e config da unidade.
// Na v0.1 as estações da sessão começam abertas (a tela da estação não tem "abrir/fechar" ainda).
export async function buildDay(db: TenantDatabase, sessionId: string): Promise<SessionDay> {
  const { s, srv, u } = await rows(db, sessionId, false);
  const ests = await db
    .select({ e: station })
    .from(sessionStation)
    .innerJoin(station, eq(sessionStation.stationId, station.id))
    .where(eq(sessionStation.sessionId, sessionId));
  const servicesOf = async (stationId: string) =>
    (
      await db
        .select({ id: stationService.serviceId })
        .from(stationService)
        .where(eq(stationService.stationId, stationId))
    ).map((x) => x.id);
  const stations = await Promise.all(
    ests
      .filter(({ e }) => e.archivedAt === null)
      .map(async ({ e }) => ({
        id: e.id,
        stage: e.stage,
        services: await servicesOf(e.id),
        open: true,
        calledItemId: null,
      })),
  );
  const initialTimeMin: SessionDay["initialTimeMin"] = { care: srv.averageCareTimeMin };
  if (srv.averageTriageTimeMin !== null) initialTimeMin.triage = srv.averageTriageTimeMin;
  return {
    sessionId: s.id,
    serviceId: srv.id,
    state: "planned",
    items: [],
    calls: [],
    leaveHomeNotices: [],
    initialTimeMin,
    stations,
    config: unitConfig(u),
    contingencies: [],
    nextNumber: 1,
    ticketPrefix: srv.prefix,
    requiresTriage: srv.requiresTriage,
  };
}

export type SessionContext = {
  tx: TenantTx;
  row: SessionRow;
  rowService: ServiceRow;
  rowUnit: UnitRow;
  session: SessionSlots;
  service: Service;
  /** `null` enquanto planejada (PD-44). */
  day: SessionDay | null;
  /** Entradas que apontam para esta sessão. */
  entries: Entry[];
};

export type Changes<T> = {
  day?: SessionDay | null;
  session?: SessionSlots;
  entries?: Entry[];
  /** Eventos do domínio desta mudança; os que viram aviso ao paciente vão para a outbox (PD-49). */
  events?: Event[];
  result: T;
};

// PD-43 / INV-04: trava a sessão, roda `fn` e grava dia, entradas mudadas e vagas na mesma transação.
export async function inSession<T>(
  db: TenantDb | TenantTx,
  sessionId: string,
  fn: (c: SessionContext) => Promise<Changes<T>>,
): Promise<T> {
  const body = async (tx: TenantTx) => {
    const { s, srv, u } = await rows(tx, sessionId, true);
    const day = await readDay(tx, sessionId);
    const entries = await sessionEntries(tx, sessionId);
    const m = await fn({
      tx,
      row: s,
      rowService: srv,
      rowUnit: u,
      session: toSessionSlots(s),
      service: forService(srv),
      day,
      entries,
    });
    const before = new Map(entries.map((e) => [e.id, JSON.stringify(e)]));
    for (const e of m.entries ?? []) {
      if (before.get(e.id) !== JSON.stringify(e)) await updateEntry(tx, e);
    }
    if (m.events) {
      const local = { unit: u.name, start: s.start, timeZone: u.timeZone };
      await saveNotices(tx, local, m.day ?? day, m.entries ?? entries, m.events);
    }
    const changes: Partial<typeof session.$inferInsert> = {};
    if (m.session && m.session.taken !== s.taken) changes.taken = m.session.taken;
    if (m.day && m.day.state !== "planned") {
      await tx
        .insert(sessionDay)
        .values({ sessionId, day: m.day, qrSecret: randomBytes(32).toString("base64url") })
        .onConflictDoUpdate({ target: sessionDay.sessionId, set: { day: m.day, updatedAt: new Date() } });
      if (m.day.state !== s.state) changes.state = m.day.state;
    }
    if (Object.keys(changes).length > 0) {
      await tx
        .update(session)
        .set({ ...changes, version: s.version + 1 })
        .where(eq(session.id, sessionId));
    }
    return m.result;
  };
  if (db instanceof PgTransaction) return body(db as TenantTx);
  return (db as TenantDb).transaction(body);
}
