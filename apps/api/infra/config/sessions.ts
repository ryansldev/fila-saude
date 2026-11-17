import {
  changeVisibility,
  fillFromReserve,
  type ServiceMode,
  type SessionConfig,
  validateSession,
} from "@fila-saude/domain";
import type { Session, SessionEdit, SessionInput, VisibilityInput } from "@fila-saude/schemas/session";
import { and, asc, eq, gte, inArray, isNull, lt, notInArray } from "drizzle-orm";
import { entry } from "infra/database/municipal/schema/entry";
import { service } from "infra/database/municipal/schema/service";
import { session, sessionStation } from "infra/database/municipal/schema/session";
import { station, stationService } from "infra/database/municipal/schema/station";
import type { TenantDatabase } from "infra/database/tenants";
import { ApiError, domainFields } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { inSession } from "infra/queue/day";
import { CONFIGURE, requireUnit, SESSION } from "./common";
import { requireService } from "./services";

type Row = typeof session.$inferSelect;

export async function forSession(db: TenantDatabase, s: Row): Promise<Session> {
  const stations = await db
    .select({ id: sessionStation.stationId })
    .from(sessionStation)
    .where(eq(sessionStation.sessionId, s.id));
  return {
    id: s.id,
    serviceId: s.serviceId,
    start: s.start.toISOString(),
    end: s.end.toISOString(),
    slots: s.slots,
    taken: s.taken,
    visibility: s.visibility,
    waivesPreRegistration: s.waivesPreRegistration,
    professional: s.professional,
    stations: stations.map((e) => e.id),
    state: s.state,
    version: s.version,
  };
}

async function serviceStations(db: TenantDatabase, serviceId: string) {
  return db
    .select({ id: station.id, stage: station.stage })
    .from(stationService)
    .innerJoin(station, eq(stationService.stationId, station.id))
    .where(and(eq(stationService.serviceId, serviceId), isNull(station.archivedAt)));
}

// RN-ENC-05 / AD-016: a configuração valida pelo domínio; erros de campo → 400, regulado público → 409.
async function verify(
  db: TenantDatabase,
  s: { id: string; mode: ServiceMode; requiresTriage: boolean },
  c: SessionConfig,
) {
  const ests = await serviceStations(db, s.id);
  const v = validateSession(
    {
      mode: s.mode,
      serviceStations: ests.map((e) => e.id),
      requiresTriage: s.requiresTriage,
      stages: Object.fromEntries(ests.map((e) => [e.id, e.stage])),
    },
    c,
  );
  if (v.ok) return;
  if (v.error === "regulated_service") throw new ApiError(409, "regulated_service");
  throw new ApiError(400, "invalid_input", domainFields(v.fields ?? {}));
}

async function switchStations(db: TenantDatabase, sessionId: string, stations: string[]) {
  await db.delete(sessionStation).where(eq(sessionStation.sessionId, sessionId));
  if (stations.length > 0)
    await db.insert(sessionStation).values(stations.map((stationId) => ({ sessionId, stationId })));
}

export async function requireSession(db: TenantDatabase, id: string) {
  const [row] = await db
    .select({ s: session, service })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .where(eq(session.id, id));
  if (!row) throw new ApiError(404, "not_found");
  return row;
}

// T2.5: sessão avulsa do serviço da unidade.
export async function createSession(ctx: ActionContext, unitId: string, data: SessionInput): Promise<Session> {
  await requireUnit(ctx.db, unitId);
  const s = await requireService(ctx.db, data.serviceId).catch(() => null);
  if (!s || s.unitId !== unitId) throw new ApiError(400, "invalid_input", { serviceId: ["serviço desta unidade"] });
  return runAction(ctx, { action: CONFIGURE, target: { kind: "session", id: (x) => x.id }, unitId }, async (tx) => {
    await verify(tx, s, data);
    const [row] = await tx
      .insert(session)
      .values({
        serviceId: s.id,
        start: new Date(data.start),
        end: new Date(data.end),
        slots: data.slots,
        visibility: data.visibility,
        waivesPreRegistration: data.waivesPreRegistration,
        professional: data.professional,
      })
      .returning();
    const fresh = row as Row;
    await switchStations(tx, fresh.id, data.stations);
    return forSession(tx, fresh);
  });
}

function lock(current: Row, version: number) {
  if (current.version !== version)
    throw new ApiError(409, "outdated_version", undefined, "A sessão mudou. Recarregue.");
}

async function save(tx: TenantDatabase, current: Row, changes: Partial<typeof session.$inferInsert>): Promise<Row> {
  const [row] = await tx
    .update(session)
    .set({ ...changes, version: current.version + 1 })
    .where(and(eq(session.id, current.id), eq(session.version, current.version)))
    .returning();
  if (!row) throw new ApiError(409, "outdated_version", undefined, "A sessão mudou. Recarregue.");
  return row;
}

export async function editSession(ctx: ActionContext, id: string, data: SessionEdit): Promise<Session> {
  const { s: current, service: srv } = await requireSession(ctx.db, id);
  return runAction(ctx, { action: CONFIGURE, target: { kind: "session", id }, unitId: srv.unitId }, async (tx) => {
    lock(current, data.version);
    const start = data.start ? new Date(data.start) : current.start;
    const end = data.end ? new Date(data.end) : current.end;
    const changedTime = start.getTime() !== current.start.getTime() || end.getTime() !== current.end.getTime();
    if (changedTime && current.state !== "planned") throw new ApiError(409, "forbidden_transition");
    // Com a sessão aberta, as estações já estão no dia: tirar uma com paciente chamado travaria o encerramento.
    if (data.stations && current.state !== "planned")
      throw new ApiError(409, "forbidden_transition", undefined, "As estações só mudam antes de abrir a sessão.");
    if (end <= start) throw new ApiError(400, "invalid_input", { end: ["fim deve ser depois do início"] });
    const slots = data.slots !== undefined ? data.slots : current.slots;
    if (slots !== null && slots < current.taken) {
      throw new ApiError(409, "slots_below_taken", undefined, undefined, { taken: current.taken });
    }
    const stations =
      data.stations ??
      (
        await tx.select({ id: sessionStation.stationId }).from(sessionStation).where(eq(sessionStation.sessionId, id))
      ).map((e) => e.id);
    await verify(tx, srv, {
      slots,
      visibility: current.visibility,
      waivesPreRegistration: current.waivesPreRegistration,
      professional: data.professional !== undefined ? data.professional : current.professional,
      stations,
    });
    const row = await save(tx, current, {
      start,
      end,
      slots,
      ...(data.professional !== undefined ? { professional: data.professional } : {}),
    });
    if (data.stations) await switchStations(tx, id, data.stations);
    // RN-PUB-02: vaga a mais vai ao primeiro da reserva.
    const slotMore = current.slots !== null && (slots === null || slots > current.slots);
    if (slotMore && row.visibility === "public" && (row.state === "planned" || row.state === "open")) {
      await inSession(tx, id, async (c) => {
        const r = fillFromReserve(c.session, c.day, c.entries, { service: c.service, acceptedPhotos: [] }, ctx.now);
        if (!r.ok) return { result: null };
        return { day: r.state.day, session: r.state.session, entries: r.state.entries, result: null };
      });
      const [fresh] = await tx.select().from(session).where(eq(session.id, id));
      return forSession(tx, fresh ?? row);
    }
    return forSession(tx, row);
  });
}

// RN-PUB-03: privada perde a dispensa; pública não vale em serviço regulado.
export async function changeSessionVisibility(ctx: ActionContext, id: string, data: VisibilityInput): Promise<Session> {
  const { s: current, service: srv } = await requireSession(ctx.db, id);
  return runAction(ctx, { action: SESSION, target: { kind: "session", id }, unitId: srv.unitId }, async (tx) => {
    lock(current, data.version);
    const config: SessionConfig = {
      slots: current.slots,
      visibility: current.visibility,
      waivesPreRegistration: current.waivesPreRegistration,
      professional: current.professional,
      stations: [],
    };
    const r = changeVisibility(config, data.visibility, srv.mode);
    if (!r.ok) throw new ApiError(409, r.error);
    let waives = r.state.waivesPreRegistration;
    if (data.waivesPreRegistration !== undefined) {
      if (data.waivesPreRegistration && r.state.visibility !== "public") {
        throw new ApiError(400, "invalid_input", { waivesPreRegistration: ["a dispensa só vale em sessão pública"] });
      }
      waives = data.waivesPreRegistration;
    }
    const row = await save(tx, current, { visibility: r.state.visibility, waivesPreRegistration: waives });
    return forSession(tx, row);
  });
}

const FINAL_STATES = ["cancelled", "completed", "closed_without_care", "archived"] as const;

// Só planejada e sem pacientes na v0.1 (o remanejamento vem depois).
export async function cancelSession(ctx: ActionContext, id: string): Promise<Session> {
  const { s: current, service: srv } = await requireSession(ctx.db, id);
  return runAction(ctx, { action: SESSION, target: { kind: "session", id }, unitId: srv.unitId }, async (tx) => {
    if (current.state !== "planned") throw new ApiError(409, "forbidden_transition");
    const [withValue] = await tx
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.sessionId, id), notInArray(entry.state, [...FINAL_STATES])));
    if (withValue) throw new ApiError(409, "session_has_patients", undefined, "Há pacientes nesta sessão.");
    const row = await save(tx, current, { state: "cancelled" });
    return forSession(tx, row);
  });
}

export async function listSessions(
  ctx: ActionContext,
  unitId: string,
  interval: { from: Date; until: Date },
): Promise<Session[]> {
  const services = (await ctx.db.select({ id: service.id }).from(service).where(eq(service.unitId, unitId))).map(
    (s) => s.id,
  );
  if (services.length === 0) return [];
  const rows = await ctx.db
    .select()
    .from(session)
    .where(
      and(inArray(session.serviceId, services), gte(session.start, interval.from), lt(session.start, interval.until)),
    )
    .orderBy(asc(session.start));
  return Promise.all(rows.map((s) => forSession(ctx.db, s)));
}
