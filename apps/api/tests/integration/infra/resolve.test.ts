import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import Fastify from "fastify";
import { schemaCentral } from "infra/database";
import { databaseUrl, type Tenant, type TenantSource, tenantSource } from "infra/database/tenants";
import env from "infra/env";
import { handleError, notFound } from "infra/errors";
import tenantPlugin from "infra/tenant/plugin";
import { Pool } from "pg";
import orchestrator from "tests/orchestrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

// Central de verdade (o Postgres de teste), com cada consulta contada no próprio pool.
const centralPool = new Pool({ connectionString: env.DATABASE_URL });
let centralQueries = 0;
const query = centralPool.query.bind(centralPool);
centralPool.query = ((...args: Parameters<typeof query>) => {
  centralQueries += 1;
  return query(...args);
}) as typeof centralPool.query;
const central = drizzle(centralPool, { schema: schemaCentral });

const fonts: TenantSource[] = [];

let a: Awaited<ReturnType<typeof orchestrator.createMunicipality>>;
let b: Awaited<ReturnType<typeof orchestrator.createMunicipality>>;

beforeAll(async () => {
  a = await orchestrator.createMunicipality({ timeZone: "America/Recife" });
  b = await orchestrator.createMunicipality();
});

afterEach(async () => {
  for (const font of fonts.splice(0)) await font.close();
});

afterAll(async () => {
  await orchestrator.dropMunicipalities();
  await centralPool.end();
});

// O mesmo plugin do server.ts, com uma rota de tenant pelo caminho e outra só pelo Host.
async function buildApp(mode: "multi" | "single") {
  const font = tenantSource({
    mode,
    central,
    max: 10,
    connectionsByTenant: 2,
    ttlCatalogMs: 0,
    fixedSlug: a.slug,
    fixedUrl: databaseUrl(`template:${a.database}`, { template: env.TENANT_DATABASE_URL_TEMPLATE, env: {} }),
    timeZone: "America/Manaus",
  });
  fonts.push(font);

  const app = Fastify();
  app.setErrorHandler(handleError);
  app.setNotFoundHandler(notFound);
  app.register(tenantPlugin, {
    pools: font,
    config: { mode, domainBase: env.TENANT_BASE_DOMAIN, fixedSlug: a.slug },
  });
  app.register(async (routes) => {
    const answer = async (req: { tenant: Tenant | null }) => {
      const tenant = req.tenant;
      if (!tenant) throw new Error("exigirTenant deixou passar sem tenant");
      const result = await tenant.db.execute<{ database: string }>(sql`select current_database() as database`);
      return { slug: tenant.slug, timeZone: tenant.timeZone, database: result.rows[0]?.database };
    };
    routes.get("/v1/municipalities/:slug/database", { preHandler: routes.requireTenant }, answer);
    routes.get("/v1/panel/database", { preHandler: routes.requireTenant }, answer);
  });
  await app.ready();
  return app;
}

describe("resolução do tenant no processo", () => {
  it("PD-15: modo single ignora o catálogo e recusa outro slug", async () => {
    const app = await buildApp("single");
    centralQueries = 0;
    try {
      const byRoot = await app.inject({ url: `/v1/municipalities/${a.slug}/database`, headers: { host: "localhost" } });
      expect(byRoot.statusCode).toBe(200);
      // Fuso do ambiente (TENANT_TIME_ZONE), não o do catálogo (America/Recife): o central não é lido.
      expect(byRoot.json()).toEqual({ slug: a.slug, timeZone: "America/Manaus", database: a.database });

      // Domínio próprio da prefeitura e rota sem `:slug`: o tenant é sempre o fixo.
      const withoutPath = await app.inject({ url: "/v1/panel/database", headers: { host: "fila.prefeitura.gov.br" } });
      expect(withoutPath.statusCode).toBe(200);
      expect(withoutPath.json()).toMatchObject({ slug: a.slug, database: a.database });

      // B existe e está ativo no catálogo, mas esta VPS só atende A: mesmo 404 de um slug inexistente.
      const other = await app.inject({ url: `/v1/municipalities/${b.slug}/database`, headers: { host: "localhost" } });
      const nonexistent = await app.inject({
        url: `/v1/municipalities/${orchestrator.uniqueSlug()}/database`,
        headers: { host: "localhost" },
      });
      expect(other.statusCode).toBe(404);
      expect(other.body).toBe('{"error":"unknown_municipality"}');
      expect(nonexistent.body).toBe(other.body);

      // Nem com o Host de B: no modo single o Host não escolhe tenant.
      const bHost = await app.inject({
        url: `/v1/municipalities/${b.slug}/database`,
        headers: { host: `${b.slug}.${env.TENANT_BASE_DOMAIN}:3333` },
      });
      expect(bHost.statusCode).toBe(404);

      expect(centralQueries).toBe(0);
    } finally {
      await app.close();
    }
  });

  it("PD-15: modo multi consulta o catálogo (o contador do central funciona)", async () => {
    const app = await buildApp("multi");
    centralQueries = 0;
    try {
      const response = await app.inject({
        url: `/v1/municipalities/${b.slug}/database`,
        headers: { host: "localhost" },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ slug: b.slug, database: b.database });
      expect(centralQueries).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it("PD-15: modo multi, Host de A com caminho de B → 400 sem consultar o catálogo", async () => {
    const app = await buildApp("multi");
    centralQueries = 0;
    try {
      const response = await app.inject({
        url: `/v1/municipalities/${b.slug}/database`,
        headers: { host: `${a.slug}.${env.TENANT_BASE_DOMAIN}:3333` },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: "municipality_mismatch" });
      expect(centralQueries).toBe(0);
    } finally {
      await app.close();
    }
  });
});
