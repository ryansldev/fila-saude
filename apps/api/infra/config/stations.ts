import type { Station, StationEdit, StationInput } from "@fila-saude/schemas/station";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { service } from "infra/database/municipal/schema/service";
import { session, sessionStation } from "infra/database/municipal/schema/session";
import { station, stationService } from "infra/database/municipal/schema/station";
import type { TenantDatabase } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { CONFIGURE, requireUnit } from "./common";

type Row = typeof station.$inferSelect;

async function forStation(db: TenantDatabase, e: Row): Promise<Station> {
  const services = await db
    .select({ id: stationService.serviceId })
    .from(stationService)
    .where(eq(stationService.stationId, e.id));
  return {
    id: e.id,
    unitId: e.unitId,
    name: e.name,
    stage: e.stage,
    services: services.map((s) => s.id),
    open: e.open,
  };
}

// RN-EST-01 / RN-TRI-02: serviços da mesma unidade; estação de triagem só com serviços que exigem triagem.
async function validateServices(db: TenantDatabase, unitId: string, stage: Row["stage"], ids: string[]) {
  const found = await db.select().from(service).where(inArray(service.id, ids));
  if (found.length !== new Set(ids).size || found.some((s) => s.unitId !== unitId)) {
    throw new ApiError(400, "invalid_input", { services: ["só serviços desta unidade"] });
  }
  if (stage === "triage" && found.some((s) => !s.requiresTriage)) {
    throw new ApiError(400, "invalid_input", {
      services: ["estação de triagem só atende serviços que exigem triagem"],
    });
  }
}

export async function requireStation(db: TenantDatabase, id: string): Promise<Row> {
  const [e] = await db
    .select()
    .from(station)
    .where(and(eq(station.id, id), isNull(station.archivedAt)));
  if (!e) throw new ApiError(404, "not_found");
  return e;
}

export async function createStation(ctx: ActionContext, unitId: string, data: StationInput): Promise<Station> {
  await requireUnit(ctx.db, unitId);
  return runAction(ctx, { action: CONFIGURE, target: { kind: "station", id: (e) => e.id }, unitId }, async (tx) => {
    await validateServices(tx, unitId, data.stage, data.services);
    const [e] = await tx.insert(station).values({ unitId, name: data.name, stage: data.stage }).returning();
    const row = e as Row;
    await tx.insert(stationService).values(data.services.map((serviceId) => ({ stationId: row.id, serviceId })));
    return forStation(tx, row);
  });
}

export async function editStation(ctx: ActionContext, id: string, data: StationEdit): Promise<Station> {
  const current = await requireStation(ctx.db, id);
  return runAction(ctx, { action: CONFIGURE, target: { kind: "station", id }, unitId: current.unitId }, async (tx) => {
    let row = current;
    if (data.name !== undefined) {
      const [e] = await tx.update(station).set({ name: data.name }).where(eq(station.id, id)).returning();
      row = e as Row;
    }
    if (data.services) {
      await validateServices(tx, current.unitId, current.stage, data.services);
      await tx.delete(stationService).where(eq(stationService.stationId, id));
      await tx.insert(stationService).values(data.services.map((serviceId) => ({ stationId: id, serviceId })));
    }
    return forStation(tx, row);
  });
}

export async function archiveStation(ctx: ActionContext, id: string): Promise<void> {
  const current = await requireStation(ctx.db, id);
  await runAction(ctx, { action: CONFIGURE, target: { kind: "station", id }, unitId: current.unitId }, async (tx) => {
    if (current.open) throw new ApiError(409, "station_busy", undefined, "A estação está aberta.");
    // Sessão planejada ou aberta que usa a estação ficaria sem quem chama (ou sem poder encerrar).
    const [inUse] = await tx
      .select({ id: session.id })
      .from(sessionStation)
      .innerJoin(session, eq(sessionStation.sessionId, session.id))
      .where(and(eq(sessionStation.stationId, id), inArray(session.state, ["planned", "open"])))
      .limit(1);
    if (inUse)
      throw new ApiError(
        409,
        "station_in_use",
        undefined,
        "A estação está em uma sessão planejada ou aberta. Tire-a dessas sessões antes de remover.",
      );
    await tx
      .update(station)
      .set({ archivedAt: new Date(ctx.now) })
      .where(eq(station.id, id));
  });
}

export async function listStations(ctx: ActionContext, unitId: string): Promise<Station[]> {
  const rows = await ctx.db
    .select()
    .from(station)
    .where(and(eq(station.unitId, unitId), isNull(station.archivedAt)))
    .orderBy(asc(station.createdAt));
  return Promise.all(rows.map((e) => forStation(ctx.db, e)));
}
