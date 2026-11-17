import { eq, sql } from "drizzle-orm";
import database from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import { databaseUrl, TenantsPools } from "infra/database/tenants";
import { databaseForSlug } from "infra/tenant/slug";
import orchestrator from "tests/orchestrator";
import { afterAll, afterEach, describe, expect, it } from "vitest";

const open: TenantsPools[] = [];

function newPools(options: Partial<ConstructorParameters<typeof TenantsPools>[0]> = {}) {
  const pools = new TenantsPools({ max: 10, connectionsByTenant: 2, central: database, ttlCatalogMs: 0, ...options });
  open.push(pools);
  return pools;
}

async function municipalityWithoutDatabase(status: "creating" | "suspended") {
  const slug = orchestrator.uniqueSlug();
  await database
    .insert(municipality)
    .values({ slug, name: "Sem banco", uf: "SP", databaseRef: `template:${databaseForSlug(slug)}`, status });
  return slug;
}

describe("TenantPools", () => {
  afterEach(async () => {
    for (const pools of open.splice(0)) await pools.close();
  });

  afterAll(async () => {
    await orchestrator.dropMunicipalities();
  });

  it("PD-14: databaseUrl expande template e env, recusa prefixo desconhecido", () => {
    const deps = { template: "postgresql://h:1/{database}", env: { DATABASE_A: "postgresql://a:2/fila_t_a" } };

    expect(databaseUrl("template:fila_t_x", deps)).toBe("postgresql://h:1/fila_t_x");
    expect(databaseUrl("env:DATABASE_A", deps)).toBe("postgresql://a:2/fila_t_a");
    expect(() => databaseUrl("env:DATABASE_B", deps)).toThrow(/variável de ambiente ausente: DATABASE_B/);
    expect(() => databaseUrl("env:", deps)).toThrow(/sem nome/);
    expect(() => databaseUrl("template:", deps)).toThrow(/sem nome/);
    expect(() => databaseUrl("ftp:fila_t_x", deps)).toThrow(/referência de banco desconhecida: ftp:/);
  });

  it("pool: mesmo slug devolve a mesma instância", async () => {
    const { slug, municipalityId } = await orchestrator.createMunicipality({ timeZone: "America/Recife" });
    const pools = newPools();

    const first = await pools.get(slug);
    const second = await pools.get(slug);

    expect(first).toMatchObject({ slug, municipalityId, timeZone: "America/Recife" });
    expect(second?.db).toBe(first?.db);
    // O pool aponta para o banco do tenant, não para o central.
    const result = await first?.db.execute<{ database: string }>("select current_database() as database");
    expect(result?.rows[0]?.database).toBe(databaseForSlug(slug));
  });

  it("pool: com max 2, o terceiro tenant encerra o menos usado", async () => {
    const a = await orchestrator.createMunicipality();
    const b = await orchestrator.createMunicipality();
    const c = await orchestrator.createMunicipality();
    const pools = newPools({ max: 2 });

    const tenantA = await pools.get(a.slug);
    const tenantB = await pools.get(b.slug);
    await tenantB?.db.execute("select 1");
    await pools.get(a.slug); // A passa a ser o mais recente; B vira o menos usado.
    const tenantC = await pools.get(c.slug);

    expect(tenantB?.db.$client.ended).toBe(true);
    expect(tenantA?.db.$client.ended).toBe(false);
    expect(tenantC?.db.$client.ended).toBe(false);

    // B volta com um pool novo.
    const again = await pools.get(b.slug);
    expect(again?.db).not.toBe(tenantB?.db);
    expect(again?.db.$client.ended).toBe(false);
    expect(tenantA?.db.$client.ended).toBe(true);

    await pools.close();
    expect(tenantC?.db.$client.ended).toBe(true);
    expect(again?.db.$client.ended).toBe(true);
  });

  it("pool: slug desconhecido, criando ou suspenso → null", async () => {
    const creating = await municipalityWithoutDatabase("creating");
    const suspended = await municipalityWithoutDatabase("suspended");
    const pools = newPools();

    expect(await pools.get(orchestrator.uniqueSlug())).toBeNull();
    expect(await pools.get(creating)).toBeNull();
    expect(await pools.get(suspended)).toBeNull();
  });

  it("pool: mudança de status no catálogo aparece depois do TTL", async () => {
    const { slug } = await orchestrator.createMunicipality();
    const pools = newPools({ ttlCatalogMs: 200 });

    const active = await pools.get(slug);
    expect(active).not.toBeNull();
    await database.update(municipality).set({ status: "suspended" }).where(eq(municipality.slug, slug));

    expect(await pools.get(slug)).not.toBeNull(); // ainda no cache do catálogo
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(await pools.get(slug)).toBeNull();
    // Suspenso, o pool do tenant é encerrado na hora.
    expect(active?.db.$client.ended).toBe(true);
  });
  it("pool: conexão derrubada no banco do tenant não derruba o processo e o próximo obter reconecta", async () => {
    const { slug } = await orchestrator.createMunicipality();
    const errors: string[] = [];
    const pools = newPools({ register: (message) => errors.push(message) });

    const before = await pools.get(slug);
    await before?.db.execute("select 1"); // deixa um cliente ocioso no pool
    expect(before?.db.$client.idleCount).toBe(1);

    await database.execute(
      sql`select pg_terminate_backend(pid) from pg_stat_activity where datname = ${databaseForSlug(slug)} and pid <> pg_backend_pid()`,
    );
    for (let i = 0; i < 50 && errors.length === 0; i++) await new Promise((r) => setTimeout(r, 20));

    expect(errors).toEqual([expect.stringContaining(slug)]);
    const after = await pools.get(slug);
    expect(after?.db).not.toBe(before?.db);
    const result = await after?.db.execute<{ one: number }>("select 1 as one");
    expect(result?.rows[0]?.one).toBe(1);
  });

  it("pool: encerrar fecha todos mesmo quando um pool.end() falha", async () => {
    const a = await orchestrator.createMunicipality();
    const b = await orchestrator.createMunicipality();
    const errors: string[] = [];
    const pools = newPools({ register: (message) => errors.push(message) });

    const tenantA = await pools.get(a.slug);
    const tenantB = await pools.get(b.slug);
    await tenantA?.db.$client.end(); // o segundo end() deste pool rejeita

    await expect(pools.close()).resolves.toBeUndefined();
    expect(tenantB?.db.$client.ended).toBe(true);
    expect(errors).toEqual([expect.stringContaining(a.slug)]);
  });
});
