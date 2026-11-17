import type { FastifyRequest } from "fastify";
import { ApiError } from "infra/errors";

/** O banco do município nas rotas públicas do app (agenda, unidades), depois de `app.requireTenant`. */
export function publicTenantDb(req: FastifyRequest) {
  if (!req.tenant) throw new ApiError(404, "unknown_municipality");
  return req.tenant.db;
}
