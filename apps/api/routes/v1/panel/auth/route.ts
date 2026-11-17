import type { FastifyInstance, FastifyRequest } from "fastify";
import { buildAuth } from "infra/auth/fastify";
import { tenantAuth } from "infra/auth/panel";

function tenantOf(req: FastifyRequest) {
  if (!req.tenant) throw new Error("exigirTenant deixou passar sem tenant");
  return req.tenant;
}

// PD-39: auth do painel no host do município (`/v1/panel/auth/*`).
export default async function (app: FastifyInstance) {
  buildAuth(
    app,
    "",
    (req) => {
      const t = tenantOf(req);
      return tenantAuth(t.slug, t.db);
    },
    { preHandler: app.requireTenant, usernameField: "login" },
  );
}
