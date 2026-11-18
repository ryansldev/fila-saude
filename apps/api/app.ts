import path from "node:path";
import { fileURLToPath } from "node:url";
import autoload from "@fastify/autoload";
import Fastify, { type FastifyInstance } from "fastify";
import { attemptErrors } from "infra/auth/attempts";
import { trustProxyOption } from "infra/auth/fastify";
import { patientPlugin } from "infra/auth/patient-session";
import database from "infra/database";
import { tenantSource } from "infra/database/tenants";
import env from "infra/env";
import { handleError, notFound } from "infra/errors";
import { startSweep } from "infra/notices/sweep";
import { registerRoutes } from "infra/panel/action";
import { panelCors } from "infra/panel/cors";
import { activeMunicipalities } from "infra/queue/app";
import tenantPlugin from "infra/tenant/plugin";

const root = path.dirname(fileURLToPath(import.meta.url));

// Monta o app sem `listen` (servidor e testes de infra usam o mesmo).
export async function buildApp(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  // AD-064: só os proxies de TRUSTED_PROXIES informam o IP do cliente (`req.ip`); sem eles, vale a conexão.
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: trustProxyOption(env.TRUSTED_PROXIES),
  });

  // AD-063: erros da contagem de tentativas que não derrubam o pedido vão para o log do app.
  attemptErrors.log = (err, what) => app.log.error({ err }, what);

  app.setErrorHandler(handleError);
  app.setNotFoundHandler(notFound);
  registerRoutes(app);
  panelCors(app);

  // T1.7 / PD-03: um pool por município, em LRU; fechado junto com o app. No modo single (PD-12), um
  // pool só, para TENANT_DATABASE_URL, sem consultar o catálogo do central.
  const pools = tenantSource({
    mode: env.TENANT_MODE,
    max: 50,
    connectionsByTenant: 5,
    central: database,
    ttlCatalogMs: env.TENANT_CACHE_TTL_MS,
    ...(env.TENANT_SLUG ? { fixedSlug: env.TENANT_SLUG } : {}),
    ...(env.TENANT_DATABASE_URL ? { fixedUrl: env.TENANT_DATABASE_URL } : {}),
    timeZone: env.TENANT_TIME_ZONE,
  });
  app.addHook("onClose", () => pools.close());

  // PD-50: avisos do tempo e envio dos push; fora dos testes (lá a função é chamada direto).
  if (process.env.NODE_ENV !== "test") {
    const stop = startSweep(
      async () => (env.TENANT_SLUG ? [env.TENANT_SLUG] : (await activeMunicipalities()).map((m) => m.slug)),
      async (slug) => (await pools.get(slug))?.db ?? null,
      (error, slug) => app.log.error({ err: error, slug }, "varredura"),
    );
    app.addHook("onClose", async () => stop());
  }

  // PD-15: `app.requireTenant` resolve o tenant pelo Host e pelo caminho (`municipalities/:slug`).
  app.register(tenantPlugin, {
    pools,
    config: {
      mode: env.TENANT_MODE,
      domainBase: env.TENANT_BASE_DOMAIN,
      ...(env.TENANT_SLUG ? { fixedSlug: env.TENANT_SLUG } : {}),
    },
  });
  patientPlugin(app);

  // `routeParams`: pastas `_slug` viram `:slug` (PD-15, `/v1/municipalities/:slug/…`).
  app.register(autoload, { dir: path.join(root, "routes"), routeParams: true });

  // PD-19: rotas só de teste nunca existem fora de NODE_ENV=test.
  if (process.env.NODE_ENV === "test") {
    app.register(autoload, {
      dir: path.join(root, "test-routes"),
      routeParams: true,
      options: { prefix: "/v1/test" },
    });
  }

  return app;
}
