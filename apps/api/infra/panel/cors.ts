import type { FastifyInstance } from "fastify";
import env from "infra/env";
import { isPanelRoute } from "infra/routes/versions";
import { allowedOrigin } from "./origin";

const METHODS = "GET, POST, PUT, PATCH, DELETE";

// PD-24 / T2.1: CORS do painel com credenciais, só para a origem do painel do mesmo slug do Host.
// Mutação com `Origin` de fora é recusada aqui mesmo (CSRF), antes de qualquer rota.
export function panelCors(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    if (!origin) return;
    const allowed = allowedOrigin(origin, req.headers.host, {
      template: env.PANEL_ORIGIN_TEMPLATE,
      mode: env.TENANT_MODE,
      domainBase: env.TENANT_BASE_DOMAIN,
      ...(env.TENANT_MODE === "single" && env.TENANT_SLUG ? { fixedSlug: env.TENANT_SLUG } : {}),
    });
    if (allowed) {
      reply.header("access-control-allow-origin", origin);
      reply.header("access-control-allow-credentials", "true");
      reply.header("vary", "Origin");
      if (req.method === "OPTIONS") {
        reply.header("access-control-allow-methods", METHODS);
        reply.header("access-control-allow-headers", req.headers["access-control-request-headers"] ?? "content-type");
        reply.header("access-control-max-age", "600");
        return reply.status(204).send();
      }
      return;
    }
    const mutation = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
    // A rota registrada, e não o caminho cru: o roteador decodifica `%70anel` para `panel` (CSRF).
    const route = req.routeOptions.url ?? req.url;
    if (mutation && isPanelRoute(route)) {
      return reply.status(403).send({ error: "no_permission" });
    }
  });
}
