import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Tenant, TenantSource } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { type ResolutionConfig, resolveTenant } from "./resolve";

declare module "fastify" {
  interface FastifyRequest {
    // Preenchido só por `app.exigirTenant`; rotas da raiz (auth central, status) o deixam null.
    tenant: Tenant | null;
  }
  interface FastifyInstance {
    requireTenant: (req: FastifyRequest) => Promise<void>;
  }
}

// `pools`: `TenantsPools` no modo multi, `FixedTenant` no single (veja `tenantSource`).
export type TenantPluginOptions = { pools: TenantSource; config: ResolutionConfig };

// PD-15: só rotas `…/municipalities/:slug/…` (pasta `municipalities/_slug`) levam o município no caminho.
// Um `:slug` em outra rota não é município e não entra na resolução.
const MUNICIPALITY_ROUTE = /\/municipalities\/:slug(\/|$)/;

function pathSlug(req: FastifyRequest): string | undefined {
  if (!MUNICIPALITY_ROUTE.test(req.routeOptions.url ?? "")) return undefined;
  const slug = (req.params as { slug?: unknown } | undefined)?.slug;
  return typeof slug === "string" ? slug : undefined;
}

// PD-15: resolução preguiçosa. Só as rotas `municipalities/:slug` (pelo hook `onRoute` abaixo, no
// `preValidation`) e as que chamam `app.requireTenant` resolvem o tenant e consultam o catálogo; as da raiz nunca tocam no catálogo nem falham por falta de tenant.
// Desconhecido, suspenso, criando, host raiz e subdomínio malformado respondem o mesmo
// `404 unknown_municipality`, para não revelar se o município existe.
async function tenantPlugin(app: FastifyInstance, options: TenantPluginOptions) {
  app.decorateRequest("tenant", null);

  app.decorate("requireTenant", async (req: FastifyRequest) => {
    if (req.tenant) return;
    const resolution = resolveTenant({ host: req.headers.host, pathSlug: pathSlug(req) }, options.config);
    if ("error" in resolution) {
      if (resolution.error === "municipality_mismatch") throw new ApiError(400, "municipality_mismatch");
      throw new ApiError(404, "unknown_municipality");
    }
    const tenant = await options.pools.get(resolution.slug);
    if (!tenant) throw new ApiError(404, "unknown_municipality");
    req.tenant = tenant;
  });

  // PD-15 / DOC2: toda rota `municipalities/:slug` resolve o município antes da validação do schema,
  // para que município desconhecido seja sempre 404, mesmo com corpo ou query inválidos.
  app.addHook("onRoute", (route) => {
    if (!MUNICIPALITY_ROUTE.test(route.url)) return;
    const own = route.preValidation ? [route.preValidation].flat() : [];
    route.preValidation = [app.requireTenant, ...own];
  });
}

// Equivale ao `fastify-plugin`: decorações visíveis em todo o app, não só neste escopo.
Object.assign(tenantPlugin, { [Symbol.for("skip-override")]: true });

export default tenantPlugin;
