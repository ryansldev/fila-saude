import type { FastifyInstance, FastifyRequest } from "fastify";
import { montarAuth } from "infra/auth/fastify";
import { authDoTenant } from "infra/auth/painel";

function tenantDe(req: FastifyRequest) {
  if (!req.tenant) throw new Error("exigirTenant deixou passar sem tenant");
  return req.tenant;
}

// PD-39: auth do painel no host do município (`/v1/painel/auth/*`).
export default async function (app: FastifyInstance) {
  montarAuth(
    app,
    "",
    (req) => {
      const t = tenantDe(req);
      return authDoTenant(t.slug, t.db);
    },
    { preHandler: app.exigirTenant },
  );
}
