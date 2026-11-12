import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import Fastify from "fastify";
import { schemaCentral } from "infra/database";
import { type FonteDosTenants, fonteDosTenants, type Tenant, urlDoBanco } from "infra/database/tenants";
import env from "infra/env";
import { naoEncontrado, tratarErro } from "infra/erros";
import pluginDoTenant from "infra/tenant/plugin";
import { Pool } from "pg";
import orchestrator from "tests/orchestrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Central de verdade (o Postgres de teste), com cada consulta contada no próprio pool.
const poolDoCentral = new Pool({ connectionString: env.DATABASE_URL });
let consultasAoCentral = 0;
const consultar = poolDoCentral.query.bind(poolDoCentral);
poolDoCentral.query = ((...args: Parameters<typeof consultar>) => {
  consultasAoCentral += 1;
  return consultar(...args);
}) as typeof poolDoCentral.query;
const central = drizzle(poolDoCentral, { schema: schemaCentral });

const fontes: FonteDosTenants[] = [];

let a: Awaited<ReturnType<typeof orchestrator.criarMunicipio>>;
let b: Awaited<ReturnType<typeof orchestrator.criarMunicipio>>;

beforeAll(async () => {
  a = await orchestrator.criarMunicipio({ fuso: "America/Recife" });
  b = await orchestrator.criarMunicipio();
});

afterEach(async () => {
  for (const fonte of fontes.splice(0)) await fonte.encerrar();
});

afterAll(async () => {
  await orchestrator.derrubarMunicipios();
  await poolDoCentral.end();
});

// O mesmo plugin do server.ts, com uma rota de tenant pelo caminho e outra só pelo Host.
async function montarApp(modo: "multi" | "single") {
  const fonte = fonteDosTenants({
    modo,
    central,
    max: 10,
    conexoesPorTenant: 2,
    ttlCatalogoMs: 0,
    slugFixo: a.slug,
    urlFixa: urlDoBanco(`template:${a.banco}`, { template: env.TENANT_DATABASE_URL_TEMPLATE, env: {} }),
    fuso: "America/Manaus",
  });
  fontes.push(fonte);

  const app = Fastify();
  app.setErrorHandler(tratarErro);
  app.setNotFoundHandler(naoEncontrado);
  app.register(pluginDoTenant, {
    pools: fonte,
    config: { modo, dominioBase: env.TENANT_BASE_DOMAIN, slugFixo: a.slug },
  });
  app.register(async (rotas) => {
    const responder = async (req: { tenant: Tenant | null }) => {
      const tenant = req.tenant;
      if (!tenant) throw new Error("exigirTenant deixou passar sem tenant");
      const resultado = await tenant.db.execute<{ banco: string }>(sql`select current_database() as banco`);
      return { slug: tenant.slug, fuso: tenant.fuso, banco: resultado.rows[0]?.banco };
    };
    rotas.get("/v1/municipios/:slug/banco", { preHandler: rotas.exigirTenant }, responder);
    rotas.get("/v1/painel/banco", { preHandler: rotas.exigirTenant }, responder);
  });
  await app.ready();
  return app;
}

describe("resolução do tenant no processo", () => {
  it("PD-15: modo single ignora o catálogo e recusa outro slug", async () => {
    const app = await montarApp("single");
    consultasAoCentral = 0;
    try {
      const pelaRaiz = await app.inject({ url: `/v1/municipios/${a.slug}/banco`, headers: { host: "localhost" } });
      expect(pelaRaiz.statusCode).toBe(200);
      // Fuso do ambiente (TENANT_FUSO), não o do catálogo (America/Recife): o central não é lido.
      expect(pelaRaiz.json()).toEqual({ slug: a.slug, fuso: "America/Manaus", banco: a.banco });

      // Domínio próprio da prefeitura e rota sem `:slug`: o tenant é sempre o fixo.
      const semCaminho = await app.inject({ url: "/v1/painel/banco", headers: { host: "fila.prefeitura.gov.br" } });
      expect(semCaminho.statusCode).toBe(200);
      expect(semCaminho.json()).toMatchObject({ slug: a.slug, banco: a.banco });

      // B existe e está ativo no catálogo, mas esta VPS só atende A: mesmo 404 de um slug inexistente.
      const outro = await app.inject({ url: `/v1/municipios/${b.slug}/banco`, headers: { host: "localhost" } });
      const inexistente = await app.inject({
        url: `/v1/municipios/${orchestrator.slugUnico()}/banco`,
        headers: { host: "localhost" },
      });
      expect(outro.statusCode).toBe(404);
      expect(outro.body).toBe('{"erro":"municipio_desconhecido"}');
      expect(inexistente.body).toBe(outro.body);

      // Nem com o Host de B: no modo single o Host não escolhe tenant.
      const hostDeB = await app.inject({
        url: `/v1/municipios/${b.slug}/banco`,
        headers: { host: `${b.slug}.${env.TENANT_BASE_DOMAIN}:3333` },
      });
      expect(hostDeB.statusCode).toBe(404);

      expect(consultasAoCentral).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("PD-15: modo multi consulta o catálogo (o contador do central funciona)", async () => {
    const app = await montarApp("multi");
    consultasAoCentral = 0;
    try {
      const response = await app.inject({ url: `/v1/municipios/${b.slug}/banco`, headers: { host: "localhost" } });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ slug: b.slug, banco: b.banco });
      expect(consultasAoCentral).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it("PD-15: modo multi, Host de A com caminho de B → 400 sem consultar o catálogo", async () => {
    const app = await montarApp("multi");
    consultasAoCentral = 0;
    try {
      const response = await app.inject({
        url: `/v1/municipios/${b.slug}/banco`,
        headers: { host: `${a.slug}.${env.TENANT_BASE_DOMAIN}:3333` },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ erro: "municipio_divergente" });
      expect(consultasAoCentral).toBe(0);
    } finally {
      await app.close();
    }
  });
});
