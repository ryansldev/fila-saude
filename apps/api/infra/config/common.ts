import type { Action } from "@fila-saude/domain";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyRequest } from "fastify";
import { unit } from "infra/database/municipal/schema/unit";
import type { TenantDatabase } from "infra/database/tenants";
import { ApiError } from "infra/errors";

export const UNITS_AND_RULES: Action = "create_units_and_rules";
export const STAFF: Action = "register_staff";
export const CONFIGURE: Action = "configure_services_sessions_stations_tv";
export const SESSION: Action = "open_cancel_close_session";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Id do caminho; fora do formato é o mesmo 404 de um id que não existe.
export function pathId(req: FastifyRequest, name: string): string {
  const id = (req.params as Record<string, unknown>)[name];
  if (typeof id !== "string" || !UUID_PATTERN.test(id)) throw new ApiError(404, "not_found");
  return id;
}

export async function requireUnit(db: TenantDatabase, id: string) {
  const [u] = await db
    .select()
    .from(unit)
    .where(and(eq(unit.id, id), isNull(unit.archivedAt)));
  if (!u) throw new ApiError(404, "not_found");
  return u;
}
