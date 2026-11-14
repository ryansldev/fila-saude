import path from "node:path";
import { fileURLToPath } from "node:url";
import autoload from "@fastify/autoload";
import Fastify, { type FastifyInstance } from "fastify";
import { pluginDoPaciente } from "infra/auth/sessao-paciente";
import { iniciarVarredura } from "infra/avisos/varredura";
import database from "infra/database";
import { fonteDosTenants } from "infra/database/tenants";
import env from "infra/env";
import { naoEncontrado, tratarErro } from "infra/erros";
import { municipiosAtivos } from "infra/fila/app";
import { registrarRotas } from "infra/painel/acao";
import { corsDoPainel } from "infra/painel/cors";
import pluginDoTenant from "infra/tenant/plugin";

const raiz = path.dirname(fileURLToPath(import.meta.url));

// Monta o app sem `listen` (servidor e testes de infra usam o mesmo).
export async function construirApp(opcoes: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opcoes.logger ?? true });

  app.setErrorHandler(tratarErro);
  app.setNotFoundHandler(naoEncontrado);
  registrarRotas(app);
  corsDoPainel(app);

  // T1.7 / PD-03: um pool por município, em LRU; fechado junto com o app. No modo single (PD-12), um
  // pool só, para TENANT_DATABASE_URL, sem consultar o catálogo do central.
  const pools = fonteDosTenants({
    modo: env.TENANT_MODE,
    max: 50,
    conexoesPorTenant: 5,
    central: database,
    ttlCatalogoMs: env.TENANT_CACHE_TTL_MS,
    ...(env.TENANT_SLUG ? { slugFixo: env.TENANT_SLUG } : {}),
    ...(env.TENANT_DATABASE_URL ? { urlFixa: env.TENANT_DATABASE_URL } : {}),
    fuso: env.TENANT_FUSO,
  });
  app.addHook("onClose", () => pools.encerrar());

  // PD-50: avisos do tempo e envio dos push; fora dos testes (lá a função é chamada direto).
  if (process.env.NODE_ENV !== "test") {
    const parar = iniciarVarredura(
      async () => (env.TENANT_SLUG ? [env.TENANT_SLUG] : (await municipiosAtivos()).map((m) => m.slug)),
      async (slug) => (await pools.obter(slug))?.db ?? null,
      (erro, slug) => app.log.error({ err: erro, slug }, "varredura"),
    );
    app.addHook("onClose", async () => parar());
  }

  // PD-15: `app.exigirTenant` resolve o tenant pelo Host e pelo caminho (`municipios/:slug`).
  app.register(pluginDoTenant, {
    pools,
    config: {
      modo: env.TENANT_MODE,
      dominioBase: env.TENANT_BASE_DOMAIN,
      ...(env.TENANT_SLUG ? { slugFixo: env.TENANT_SLUG } : {}),
    },
  });
  pluginDoPaciente(app);

  // `routeParams`: pastas `_slug` viram `:slug` (PD-15, `/v1/municipios/:slug/…`).
  app.register(autoload, { dir: path.join(raiz, "routes"), routeParams: true });

  // PD-19: rotas só de teste nunca existem fora de NODE_ENV=test.
  if (process.env.NODE_ENV === "test") {
    app.register(autoload, {
      dir: path.join(raiz, "test-routes"),
      routeParams: true,
      options: { prefix: "/v1/teste" },
    });
  }

  return app;
}
