import { canChangeRequiresTriage, countActive } from "@fila-saude/domain";
import type { Service, ServiceEdit, ServiceInput } from "@fila-saude/schemas/service";
import { and, asc, eq, isNull } from "drizzle-orm";
import { entry } from "infra/database/municipal/schema/entry";
import { service } from "infra/database/municipal/schema/service";
import { session } from "infra/database/municipal/schema/session";
import { station, stationService } from "infra/database/municipal/schema/station";
import type { TenantDatabase } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { CONFIGURE, requireUnit } from "./common";

type Row = typeof service.$inferSelect;

export function forService(s: Row): Service {
  return {
    id: s.id,
    unitId: s.unitId,
    name: s.name,
    prefix: s.prefix,
    requiresTriage: s.requiresTriage,
    mode: s.mode,
    averageTimeMin: {
      ...(s.averageTriageTimeMin !== null ? { triage: s.averageTriageTimeMin } : {}),
      care: s.averageCareTimeMin,
    },
    active: s.active,
  };
}

export async function requireService(db: TenantDatabase, id: string): Promise<Row> {
  const [s] = await db.select().from(service).where(eq(service.id, id));
  if (!s) throw new ApiError(404, "not_found");
  return s;
}

async function freePrefix(db: TenantDatabase, unitId: string, prefix: string, except?: string) {
  const [other] = await db
    .select({ id: service.id })
    .from(service)
    .where(and(eq(service.unitId, unitId), eq(service.prefix, prefix)));
  if (other && other.id !== except) throw new ApiError(409, "prefix_in_use");
}

// T2.3: serviço da unidade com prefixo, triagem, modo e tempos médios.
export async function createService(ctx: ActionContext, unitId: string, data: ServiceInput): Promise<Service> {
  await requireUnit(ctx.db, unitId);
  return runAction(ctx, { action: CONFIGURE, target: { kind: "service", id: (s) => s.id }, unitId }, async (tx) => {
    await freePrefix(tx, unitId, data.prefix);
    const [s] = await tx
      .insert(service)
      .values({
        unitId,
        name: data.name,
        prefix: data.prefix,
        requiresTriage: data.requiresTriage,
        mode: data.mode,
        averageTriageTimeMin: data.averageTimeMin.triage ?? null,
        ...(data.averageTimeMin.care ? { averageCareTimeMin: data.averageTimeMin.care } : {}),
      })
      .returning();
    return forService(s as Row);
  });
}

export async function editService(ctx: ActionContext, serviceId: string, data: ServiceEdit): Promise<Service> {
  const current = await requireService(ctx.db, serviceId);
  return runAction(
    ctx,
    { action: CONFIGURE, target: { kind: "service", id: serviceId }, unitId: current.unitId },
    async (tx) => {
      // Trava o serviço (a inscrição e a lista de espera travam o mesmo): a contagem de entradas ativas
      // abaixo não deixa escapar uma entrada que chega ao mesmo tempo (PD-42).
      await tx.select({ id: service.id }).from(service).where(eq(service.id, serviceId)).for("update");
      if (data.prefix && data.prefix !== current.prefix) await freePrefix(tx, current.unitId, data.prefix, serviceId);

      if (data.requiresTriage !== undefined && data.requiresTriage !== current.requiresTriage) {
        const sessions = await tx
          .select({ state: session.state })
          .from(session)
          .where(eq(session.serviceId, serviceId));
        if (!canChangeRequiresTriage(sessions))
          throw new ApiError(409, "session_open", undefined, "Há sessão aberta deste serviço.");
        if (!data.requiresTriage) {
          const [triage] = await tx
            .select({ id: station.id })
            .from(stationService)
            .innerJoin(station, eq(stationService.stationId, station.id))
            .where(
              and(eq(stationService.serviceId, serviceId), eq(station.stage, "triage"), isNull(station.archivedAt)),
            );
          if (triage) throw new ApiError(409, "service_in_triage_station");
        }
      }

      // PD-42: na v0.1 o modo só muda sem entradas ativas.
      if (data.mode && data.mode !== current.mode) {
        const entries = await tx.select({ state: entry.state }).from(entry).where(eq(entry.serviceId, serviceId));
        const active = countActive(entries);
        if (active > 0) throw new ApiError(409, "service_has_entries", undefined, undefined, { activeEntries: active });
        if (data.mode === "regulated") {
          const [publicOne] = await tx
            .select({ id: session.id })
            .from(session)
            .where(
              and(eq(session.serviceId, serviceId), eq(session.visibility, "public"), eq(session.state, "planned")),
            );
          if (publicOne) throw new ApiError(409, "regulated_service");
        }
      }

      const [s] = await tx
        .update(service)
        .set({
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.prefix !== undefined ? { prefix: data.prefix } : {}),
          ...(data.requiresTriage !== undefined ? { requiresTriage: data.requiresTriage } : {}),
          ...(data.mode !== undefined ? { mode: data.mode } : {}),
          ...(data.averageTimeMin
            ? {
                averageTriageTimeMin: data.averageTimeMin.triage ?? null,
                ...(data.averageTimeMin.care ? { averageCareTimeMin: data.averageTimeMin.care } : {}),
              }
            : {}),
        })
        .where(eq(service.id, serviceId))
        .returning();
      return forService(s as Row);
    },
  );
}

export async function listServices(ctx: ActionContext, unitId: string): Promise<Service[]> {
  const rows = await ctx.db.select().from(service).where(eq(service.unitId, unitId)).orderBy(asc(service.createdAt));
  return rows.map(forService);
}
