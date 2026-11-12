import type { FastifyInstance, FastifyRequest } from "fastify";
import type { FonteDosTenants, Tenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ConfigDaResolucao, resolverTenant } from "./resolver";

declare module "fastify" {
  interface FastifyRequest {
    // Preenchido só por `app.exigirTenant`; rotas da raiz (auth central, status) o deixam null.
    tenant: Tenant | null;
  }
  interface FastifyInstance {
    exigirTenant: (req: FastifyRequest) => Promise<void>;
  }
}

// `pools`: `PoolsDosTenants` no modo multi, `TenantFixo` no single (veja `fonteDosTenants`).
export type OpcoesDoPluginDoTenant = { pools: FonteDosTenants; config: ConfigDaResolucao };

// PD-15: só rotas `…/municipios/:slug/…` (pasta `municipios/_slug`) levam o município no caminho.
// Um `:slug` em outra rota não é município e não entra na resolução.
const ROTA_DE_MUNICIPIO = /\/municipios\/:slug(\/|$)/;

function slugDoCaminho(req: FastifyRequest): string | undefined {
  if (!ROTA_DE_MUNICIPIO.test(req.routeOptions.url ?? "")) return undefined;
  const slug = (req.params as { slug?: unknown } | undefined)?.slug;
  return typeof slug === "string" ? slug : undefined;
}

// PD-15: resolução preguiçosa. Só as rotas que declaram `preHandler: app.exigirTenant` resolvem o
// tenant e consultam o catálogo; as da raiz nunca tocam no catálogo nem falham por falta de tenant.
// Desconhecido, suspenso, criando, host raiz e subdomínio malformado respondem o mesmo
// `404 municipio_desconhecido`, para não revelar se o município existe.
async function pluginDoTenant(app: FastifyInstance, opcoes: OpcoesDoPluginDoTenant) {
  app.decorateRequest("tenant", null);

  app.decorate("exigirTenant", async (req: FastifyRequest) => {
    const resolucao = resolverTenant({ host: req.headers.host, slugDoCaminho: slugDoCaminho(req) }, opcoes.config);
    if ("erro" in resolucao) {
      if (resolucao.erro === "municipio_divergente") throw new ErroApi(400, "municipio_divergente");
      throw new ErroApi(404, "municipio_desconhecido");
    }
    const tenant = await opcoes.pools.obter(resolucao.slug);
    if (!tenant) throw new ErroApi(404, "municipio_desconhecido");
    req.tenant = tenant;
  });
}

// Equivale ao `fastify-plugin`: decorações visíveis em todo o app, não só neste escopo.
Object.assign(pluginDoTenant, { [Symbol.for("skip-override")]: true });

export default pluginDoTenant;
