import type { FastifyInstance } from "fastify";
import env from "infra/env";
import { origemPermitida } from "./origem";

const METODOS = "GET, POST, PUT, PATCH, DELETE";

// PD-24 / T2.1: CORS do painel com credenciais, só para a origem do painel do mesmo slug do Host.
// Mutação com `Origin` de fora é recusada aqui mesmo (CSRF), antes de qualquer rota.
export function corsDoPainel(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    const origem = req.headers.origin;
    if (!origem) return;
    const permitida = origemPermitida(origem, req.headers.host, {
      template: env.PAINEL_ORIGEM_TEMPLATE,
      dominioBase: env.TENANT_BASE_DOMAIN,
    });
    if (permitida) {
      reply.header("access-control-allow-origin", origem);
      reply.header("access-control-allow-credentials", "true");
      reply.header("vary", "Origin");
      if (req.method === "OPTIONS") {
        reply.header("access-control-allow-methods", METODOS);
        reply.header("access-control-allow-headers", req.headers["access-control-request-headers"] ?? "content-type");
        reply.header("access-control-max-age", "600");
        return reply.status(204).send();
      }
      return;
    }
    const mutacao = req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
    if (mutacao && req.url.startsWith("/v1/painel")) {
      return reply.status(403).send({ erro: "sem_permissao" });
    }
  });
}
