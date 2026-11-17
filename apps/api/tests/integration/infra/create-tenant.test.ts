import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import database from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import env from "infra/env";
import { ApiError } from "infra/errors";
import { createTenant } from "infra/tenant/create";
import { databaseForSlug, validateSlug } from "infra/tenant/slug";
import { Client, escapeIdentifier } from "pg";
import { LAST_MUNICIPAL } from "tests/migrations";
import orchestrator from "tests/orchestrator";
import { afterAll, describe, expect, it } from "vitest";

const run = promisify(execFile);
const apiFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const deps = { central: database, template: env.TENANT_DATABASE_URL_TEMPLATE };

function databaseUrl(database: string) {
  return env.TENANT_DATABASE_URL_TEMPLATE.replace("{database}", database);
}

async function connected<T>(url: string, fn: (client: Client) => Promise<T>) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function databaseExists(database: string) {
  const result = await connected(env.DATABASE_URL, (c) =>
    c.query("select 1 from pg_database where datname = $1", [database]),
  );
  return result.rowCount === 1;
}

async function tenantTables(database: string) {
  return connected(databaseUrl(database), async (c) => {
    const result = await c.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    return result.rows.map((l) => l.table_name).sort();
  });
}

async function slugRows(slug: string) {
  return database.select().from(municipality).where(eq(municipality.slug, slug));
}

function apiError(status: number, code: string) {
  return expect.objectContaining({ name: "ApiError", status, code });
}

describe("createTenant", () => {
  afterAll(async () => {
    await orchestrator.dropMunicipalities();
  });

  it("T1.7: tenant:create cria o banco, migra e registra ativo", async () => {
    const slug = orchestrator.uniqueSlug();

    const { stdout } = await run(
      "npm",
      ["run", "--silent", "tenant:create", "--", "--slug", slug, "--name", "Prefeitura A", "--uf", "SP"],
      { cwd: apiFolder, env: { ...process.env, NODE_ENV: "test" } },
    );

    const [row] = await slugRows(slug);
    expect(row).toMatchObject({
      slug,
      name: "Prefeitura A",
      uf: "SP",
      timeZone: "America/Sao_Paulo",
      status: "active",
      databaseRef: `template:${databaseForSlug(slug)}`,
      migrationVersion: LAST_MUNICIPAL,
      migrationError: null,
    });
    expect(stdout).toContain(row?.id);
    expect(await databaseExists(databaseForSlug(slug))).toBe(true);
    expect(await tenantTables(databaseForSlug(slug))).toContain("local_person");

    // Pelo caminho do Vitest (orchestrator) o resultado é o mesmo, com hífen no slug.
    const withHyphen = `${orchestrator.uniqueSlug()}-b`;
    const created = await orchestrator.createMunicipality({ slug: withHyphen, timeZone: "America/Recife" });
    expect(created.database).toBe(`fila_t_${withHyphen.replace("-", "_")}`);
    const [other] = await slugRows(withHyphen);
    expect(other).toMatchObject({ id: created.municipalityId, status: "active", timeZone: "America/Recife" });
    expect(await tenantTables(created.database)).toContain("local_person");
  });

  it("slug: 3 e 30 caracteres aceitos, 2 e 31 recusados", async () => {
    expect(validateSlug("abc")).toBe(true);
    expect(validateSlug("a".repeat(30))).toBe(true);
    expect(validateSlug("ab")).toBe(false);
    expect(validateSlug("a".repeat(31))).toBe(false);

    // 30 caracteres cabem no nome do banco (limite de 63 do Postgres) e criam de verdade.
    const base = orchestrator.uniqueSlug();
    const thirty = base.padEnd(30, "x");
    const created = await orchestrator.createMunicipality({ slug: thirty });
    expect(await databaseExists(created.database)).toBe(true);

    const thirtyOne = base.padEnd(31, "x");
    await expect(createTenant({ slug: thirtyOne, name: "X", uf: "SP" }, deps)).rejects.toEqual(
      apiError(400, "invalid_slug"),
    );
    await expect(createTenant({ slug: "ab", name: "X", uf: "SP" }, deps)).rejects.toEqual(
      apiError(400, "invalid_slug"),
    );
    expect(await slugRows(thirtyOne)).toHaveLength(0);
    expect(await databaseExists(databaseForSlug(thirtyOne))).toBe(false);
  });

  it("slug: maiúscula, underscore, hífen no começo ou no fim recusados", async () => {
    for (const slug of ["Pref-a", "pref_a", "-pref-a", "pref-a-", "1pref", "pref a", "préf"]) {
      expect(validateSlug(slug), slug).toBe(false);
      await expect(createTenant({ slug, name: "X", uf: "SP" }, deps)).rejects.toBeInstanceOf(ApiError);
      await expect(createTenant({ slug, name: "X", uf: "SP" }, deps)).rejects.toEqual(apiError(400, "invalid_slug"));
      expect(await slugRows(slug)).toHaveLength(0);
    }
    expect(validateSlug("pref-a-1")).toBe(true);
  });

  it("slug repetido é recusado", async () => {
    const { slug, municipalityId } = await orchestrator.createMunicipality();

    await expect(createTenant({ slug, name: "Outra", uf: "RJ" }, deps)).rejects.toEqual(
      apiError(409, "municipality_exists"),
    );
    const rows = await slugRows(slug);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: municipalityId, name: `Município ${slug}`, uf: "SP", status: "active" });
  });

  it("L-003: duas criações simultâneas do mesmo slug criam um banco só", async () => {
    const slug = orchestrator.uniqueSlug();

    const results = await Promise.allSettled([
      createTenant({ slug, name: "A", uf: "SP" }, deps),
      createTenant({ slug, name: "A", uf: "SP" }, deps),
    ]);

    const met = results.filter((r) => r.status === "fulfilled");
    const refused = results.filter((r) => r.status === "rejected");
    expect(met).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0]?.reason).toEqual(apiError(409, "municipality_exists"));

    const rows = await slugRows(slug);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("active");
    expect(await tenantTables(databaseForSlug(slug))).toContain("local_person");
  });

  it("criação interrompida é retomada", async () => {
    const slug = orchestrator.uniqueSlug();
    const dbName = databaseForSlug(slug);
    const [interrupted] = await database
      .insert(municipality)
      .values({ slug, name: "Interrompida", uf: "MG", databaseRef: `template:${dbName}`, status: "creating" })
      .returning();
    await connected(env.DATABASE_URL, (c) => c.query(`create database ${escapeIdentifier(dbName)}`));

    const { municipalityId } = await createTenant({ slug, name: "Interrompida", uf: "MG" }, deps);

    expect(municipalityId).toBe(interrupted?.id);
    const rows = await slugRows(slug);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "active", migrationVersion: LAST_MUNICIPAL });
    expect(await tenantTables(dbName)).toContain("local_person");
  });
});
