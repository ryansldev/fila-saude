import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import database from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import { migrateAll } from "infra/database/migrate";
import env from "infra/env";
import { databaseForSlug } from "infra/tenant/slug";
import { Client, escapeIdentifier } from "pg";
import { LAST_MUNICIPAL } from "tests/migrations";
import orchestrator from "tests/orchestrator";
import { afterAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const apiFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const deps = { central: database, urlCentral: env.DATABASE_URL, template: env.TENANT_DATABASE_URL_TEMPLATE };

function serverUrl() {
  const url = new URL(env.DATABASE_URL);
  url.pathname = "/postgres";
  return url.toString();
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

async function slugRow(slug: string) {
  const [row] = await database.select().from(municipality).where(eq(municipality.slug, slug));
  return row;
}

// Simula um município que perdeu as migrations: apaga o histórico do drizzle e as tabelas.
async function resetMigrations(database: string) {
  await connected(env.TENANT_DATABASE_URL_TEMPLATE.replace("{database}", database), (c) =>
    c.query("drop schema drizzle cascade; drop schema public cascade; create schema public"),
  );
}

async function tenantTables(database: string) {
  return connected(env.TENANT_DATABASE_URL_TEMPLATE.replace("{database}", database), async (c) => {
    const result = await c.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public'",
    );
    return result.rows.map((l) => l.table_name);
  });
}

// Banco "central" descartável para o script: o nome cai no padrão que o global-setup limpa.
const scriptCentral = `fila_t_${Date.now().toString(36)}central`;

describe("migrateAll", () => {
  afterAll(async () => {
    await orchestrator.dropMunicipalities();
    await connected(serverUrl(), (c) =>
      c.query(`drop database if exists ${escapeIdentifier(scriptCentral)} with (force)`),
    );
  });

  it("PD-16: migra o central e todos os tenants", async () => {
    const a = await orchestrator.createMunicipality();
    const b = await orchestrator.createMunicipality();
    await resetMigrations(a.database);
    await resetMigrations(b.database);
    await database.update(municipality).set({ migrationVersion: null }).where(eq(municipality.slug, a.slug));
    await database.update(municipality).set({ migrationVersion: null }).where(eq(municipality.slug, b.slug));

    const result = await migrateAll(deps);

    expect(result.central).toBe("0001_attempt");
    for (const { slug, database } of [a, b]) {
      expect(result.tenants).toContainEqual({ slug, ok: true, version: LAST_MUNICIPAL });
      expect(await slugRow(slug)).toMatchObject({ migrationVersion: LAST_MUNICIPAL, migrationError: null });
      expect(await tenantTables(database)).toContain("local_person");
    }
  });

  it("PD-16: tenant com banco inacessível é marcado e os outros seguem", async () => {
    const broken = orchestrator.uniqueSlug();
    const suspended = orchestrator.uniqueSlug();
    await database.insert(municipality).values([
      {
        slug: broken,
        name: "Quebrado",
        uf: "SP",
        databaseRef: `template:${databaseForSlug(broken)}`,
        status: "active",
      },
      {
        slug: suspended,
        name: "Suspenso",
        uf: "SP",
        databaseRef: `template:${databaseForSlug(suspended)}`,
        status: "suspended",
      },
    ]);
    // Criado depois: na ordem de criação o quebrado vem antes, então um erro que parasse o laço apareceria.
    const ok = await orchestrator.createMunicipality();
    await resetMigrations(ok.database);

    const result = await migrateAll(deps);

    const fromBroken = result.tenants.find((t) => t.slug === broken);
    expect(fromBroken).toMatchObject({ slug: broken, ok: false, error: expect.stringContaining("does not exist") });
    expect(await slugRow(broken)).toMatchObject({
      migrationVersion: null,
      migrationError: expect.stringContaining("does not exist"),
    });

    expect(result.tenants).toContainEqual({ slug: ok.slug, ok: true, version: LAST_MUNICIPAL });
    expect(await tenantTables(ok.database)).toContain("local_person");

    // Suspenso não entra na rodada.
    expect(result.tenants.find((t) => t.slug === suspended)).toBeUndefined();
    expect(await slugRow(suspended)).toMatchObject({ migrationVersion: null, migrationError: null });
  });

  it("PD-16: a próxima execução retoma e limpa o erro", async () => {
    const slug = orchestrator.uniqueSlug();
    const dbName = databaseForSlug(slug);
    await database
      .insert(municipality)
      .values({ slug, name: "Retomada", uf: "SP", databaseRef: `template:${dbName}`, status: "creating" });

    const first = await migrateAll(deps);
    expect(first.tenants.find((t) => t.slug === slug)?.ok).toBe(false);
    expect((await slugRow(slug))?.migrationError).toEqual(expect.any(String));

    await connected(serverUrl(), (c) => c.query(`create database ${escapeIdentifier(dbName)}`));
    const second = await migrateAll(deps);

    expect(second.tenants).toContainEqual({ slug, ok: true, version: LAST_MUNICIPAL });
    expect(await slugRow(slug)).toMatchObject({ migrationVersion: LAST_MUNICIPAL, migrationError: null });
    expect(await tenantTables(dbName)).toContain("local_person");
  });

  it("PD-16: db:migrate cria o central se faltar e sai com 1 quando um tenant falha", async () => {
    const environment = {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: env.TENANT_DATABASE_URL_TEMPLATE.replace("{database}", scriptCentral),
      POSTGRES_DB: scriptCentral,
    };
    const run = () => execFileAsync("npm", ["run", "--silent", "db:migrate"], { cwd: apiFolder, env: environment });

    // Banco central ainda não existe: o script cria, migra e, sem tenants, sai com 0.
    const { stdout } = await run();
    expect(stdout).toContain("central: 0001_attempt");
    const tables = await connected(environment.DATABASE_URL, async (c) => {
      const r = await c.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public'",
      );
      return r.rows.map((l) => l.table_name);
    });
    expect(tables).toContain("municipality");

    const broken = orchestrator.uniqueSlug();
    await connected(environment.DATABASE_URL, (c) =>
      c.query("insert into municipality (slug, name, uf, database_ref, status) values ($1, 'Q', 'SP', $2, 'active')", [
        broken,
        `template:${databaseForSlug(broken)}`,
      ]),
    );

    const failure = await run().then(
      () => null,
      (error: { code: number; stderr: string }) => error,
    );
    expect(failure?.code).toBe(1);
    expect(failure?.stderr).toContain(broken);
  });
});
