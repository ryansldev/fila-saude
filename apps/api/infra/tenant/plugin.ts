import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolsDosTenants, Tenant } from "infra/database/tenants";
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

export type OpcoesDoPluginDoTenant = { pools: PoolsDosTenants; config: ConfigDaResolucao };

// PD-15: resolução preguiçosa. Só as rotas que declaram `preHandler: app.exigirTenant` resolvem o
// tenant e consultam o catálogo; as da raiz nunca tocam no catálogo nem falham por falta de tenant.
// Desconhecido, suspenso, criando, host raiz e subdomínio malformado respondem o mesmo
// `404 municipio_desconhecido`, para não revelar se o município existe.
async function pluginDoTenant(app: FastifyInstance, opcoes: OpcoesDoPluginDoTenant) {
  app.decorateRequest("tenant", null);

  app.decorate("exigirTenant", async (req: FastifyRequest) => {
    const resolucao = resolverTenant(
      // Task 8 passa o `:slug` de `/v1/municipios/:slug/…`; até lá só o Host decide.
      { host: req.headers.host, slugDoCaminho: undefined },
      opcoes.config,
    );
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
