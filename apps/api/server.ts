import path from "node:path";
import { fileURLToPath } from "node:url";
import autoload from "@fastify/autoload";
import Fastify from "fastify";
import database from "infra/database";
import { PoolsDosTenants } from "infra/database/tenants";
import env from "infra/env";
import { naoEncontrado, tratarErro } from "infra/erros";
import pluginDoTenant from "infra/tenant/plugin";

const app = Fastify({
  logger: true,
});

const raiz = path.dirname(fileURLToPath(import.meta.url));

app.setErrorHandler(tratarErro);
app.setNotFoundHandler(naoEncontrado);

// T1.7 / PD-03: um pool por município, em LRU; fechado junto com o app.
const pools = new PoolsDosTenants({
  max: 50,
  conexoesPorTenant: 5,
  central: database,
  ttlCatalogoMs: env.TENANT_CACHE_TTL_MS,
});
app.addHook("onClose", () => pools.encerrar());

// PD-15: `app.exigirTenant` resolve o tenant pelo Host (e, na Task 8, pelo caminho).
app.register(pluginDoTenant, {
  pools,
  config: {
    modo: env.TENANT_MODE,
    dominioBase: env.TENANT_BASE_DOMAIN,
    ...(env.TENANT_SLUG ? { slugFixo: env.TENANT_SLUG } : {}),
  },
});

app.register(autoload, { dir: path.join(raiz, "routes") });

// PD-19: rotas só de teste nunca existem fora de NODE_ENV=test.
if (process.env.NODE_ENV === "test") {
  app.register(autoload, { dir: path.join(raiz, "test-routes"), options: { prefix: "/v1/teste" } });
}

try {
  await app.listen({ port: 3333, host: "localhost" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
