import { countActive, effectiveConfig, type PartialConfig, sameDay, validateConfig } from "@fila-saude/domain";
import type { Address, EffectiveConfigOutput, TodaySummary, Unit, UnitEdit, UnitInput } from "@fila-saude/schemas/unit";
import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { entry } from "infra/database/municipal/schema/entry";
import { service } from "infra/database/municipal/schema/service";
import { session } from "infra/database/municipal/schema/session";
import { unitLink, userRole } from "infra/database/municipal/schema/staff";
import { unit } from "infra/database/municipal/schema/unit";
import { ApiError, domainFields } from "infra/errors";
import { type ActionContext, runAction } from "infra/panel/action";
import { requireUnit, UNITS_AND_RULES } from "./common";

type Row = typeof unit.$inferSelect;

export function forUnit(u: Row): Unit {
  return {
    id: u.id,
    name: u.name,
    kind: u.kind,
    cnes: u.cnes,
    address: {
      postalCode: u.postalCode,
      street: u.street,
      number: u.number,
      complement: u.complement,
      neighborhood: u.neighborhood,
    },
    lat: u.lat,
    lng: u.lng,
    timeZone: u.timeZone,
    time: u.time,
    config: u.config as Unit["config"],
  };
}

// O endereço do contrato em colunas.
function addressColumns(e: Address) {
  return {
    postalCode: e.postalCode,
    street: e.street,
    number: e.number,
    complement: e.complement ?? null,
    neighborhood: e.neighborhood,
  };
}

function validate(config: PartialConfig) {
  const r = validateConfig(config);
  if (!r.ok) {
    const fields = Object.fromEntries(Object.entries(domainFields(r.fields)).map(([k, v]) => [`config.${k}`, v]));
    throw new ApiError(400, "invalid_input", fields);
  }
}

// `null` num campo = remover a chave e voltar a herdar (PD-28).
function merge(current: PartialConfig, changes: Record<string, unknown>): PartialConfig {
  const fresh: Record<string, unknown> = { ...current };
  for (const [k, v] of Object.entries(changes)) {
    if (v === null) delete fresh[k];
    else if (v !== undefined) fresh[k] = v;
  }
  return fresh as PartialConfig;
}

// T2.2: só o gestor cria e edita unidades.
export async function createUnit(ctx: ActionContext, data: UnitInput): Promise<Unit> {
  const config = merge({}, data.config ?? {});
  validate(config);
  return runAction(ctx, { action: UNITS_AND_RULES, target: { kind: "unit", id: (u) => u.id } }, async (tx) => {
    const { address, ...rest } = data;
    const [u] = await tx
      .insert(unit)
      .values({ ...rest, ...addressColumns(address), config })
      .returning();
    return forUnit(u as Row);
  });
}

export async function editUnit(ctx: ActionContext, id: string, data: UnitEdit): Promise<Unit> {
  const current = await requireUnit(ctx.db, id);
  const config = merge(current.config, data.config ?? {});
  validate(config);
  const { config: _c, address, ...rest } = data;
  return runAction(ctx, { action: UNITS_AND_RULES, target: { kind: "unit", id }, unitId: id }, async (tx) => {
    const [u] = await tx
      .update(unit)
      .set({ ...rest, ...(address ? addressColumns(address) : {}), config })
      .where(eq(unit.id, id))
      .returning();
    return forUnit(u as Row);
  });
}

// Gestor (escopo município) vê todas; os outros, as unidades dos seus perfis.
export async function listUnits(ctx: ActionContext): Promise<Unit[]> {
  const all = ctx.actor.profiles.some((p) => p.unitId === null);
  const ids = ctx.actor.profiles.map((p) => p.unitId).filter((x): x is string => x !== null);
  if (!all && ids.length === 0) return [];
  const active = isNull(unit.archivedAt);
  const rows = await ctx.db
    .select()
    .from(unit)
    .where(all ? active : and(active, inArray(unit.id, ids)))
    .orderBy(asc(unit.createdAt), asc(unit.name));
  return rows.map(forUnit);
}

export async function readUnit(ctx: ActionContext, id: string): Promise<Unit> {
  return forUnit(await requireUnit(ctx.db, id));
}

// PD-35: o nível município é `{}` na v0.1 e herda o padrão.
export async function unitConfig(ctx: ActionContext, id: string): Promise<EffectiveConfigOutput> {
  const u = await requireUnit(ctx.db, id);
  const { origin, ...values } = effectiveConfig({ municipality: {}, unit: u.config });
  return { values, origin };
}

export function canSeeUnit(ctx: ActionContext, id: string): boolean {
  return ctx.actor.profiles.some((p) => p.unitId === null || p.unitId === id);
}

// Remover = arquivar: a unidade some das listas e a equipe perde as atribuições nela; o histórico fica.
// Recusa enquanto houver sessão planejada ou aberta, ou paciente na lista de espera.
export async function removeUnit(ctx: ActionContext, id: string): Promise<void> {
  await requireUnit(ctx.db, id);
  await runAction(
    ctx,
    { action: UNITS_AND_RULES, target: { kind: "unit", id }, unitId: id, data: () => ({ removed: true }) },
    async (tx) => {
      // Trava os serviços da unidade (a inscrição e a lista de espera travam o serviço): nenhuma entrada
      // nova escapa da conferência abaixo enquanto a unidade é removida.
      const services = (
        await tx.select({ id: service.id }).from(service).where(eq(service.unitId, id)).for("update")
      ).map((s) => s.id);
      if (services.length > 0) {
        const [withSession] = await tx
          .select({ id: session.id })
          .from(session)
          .where(and(inArray(session.serviceId, services), inArray(session.state, ["planned", "open"])));
        if (withSession) throw new ApiError(409, "unit_has_sessions");
        const active = countActive(
          await tx.select({ state: entry.state }).from(entry).where(inArray(entry.serviceId, services)),
        );
        if (active > 0) throw new ApiError(409, "unit_has_entries", undefined, undefined, { activeEntries: active });
      }
      await tx.delete(unitLink).where(eq(unitLink.unitId, id));
      await tx.delete(userRole).where(eq(userRole.unitId, id));
      await tx
        .update(unit)
        .set({ archivedAt: new Date(ctx.now) })
        .where(eq(unit.id, id));
    },
  );
}

// Troca de unidade no menu: para cada unidade que a pessoa vê, as sessões abertas agora e a próxima a abrir hoje.
export async function todaySummary(ctx: ActionContext): Promise<TodaySummary[]> {
  const units = await listUnits(ctx);
  if (units.length === 0) return [];
  const rows = await ctx.db
    .select({ unitId: service.unitId, state: session.state, start: session.start })
    .from(session)
    .innerJoin(service, eq(session.serviceId, service.id))
    .where(
      and(
        inArray(
          service.unitId,
          units.map((u) => u.id),
        ),
        inArray(session.state, ["planned", "open"]),
        gt(session.start, new Date(ctx.now - 36 * 3600_000)),
        lt(session.start, new Date(ctx.now + 36 * 3600_000)),
      ),
    );
  return units.map((u) => {
    const fromUnit = rows.filter((l) => l.unitId === u.id);
    const planned = fromUnit
      .filter((l) => l.state === "planned" && sameDay(l.start.getTime(), ctx.now, u.timeZone))
      .map((l) => l.start.getTime())
      .sort((a, b) => a - b);
    return {
      unitId: u.id,
      open: fromUnit.filter((l) => l.state === "open").length,
      nextOpening: planned[0] === undefined ? null : new Date(planned[0]).toISOString(),
    };
  });
}
