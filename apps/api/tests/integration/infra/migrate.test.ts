import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import database from "infra/database";
import { migrateDatabase } from "infra/database/migrate";
import env from "infra/env";
import { Client, escapeIdentifier } from "pg";
import { LAST_MUNICIPAL, MIGRATIONS_MUNICIPAL } from "tests/migrations";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// PD-19: cada arquivo cria os próprios bancos com nome único e derruba no afterAll.
const dbName = `fila_t_${Date.now().toString(36)}migrar`;
const tenantUrl = env.TENANT_DATABASE_URL_TEMPLATE.replace("{database}", dbName);

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

async function centralTables() {
  const result = await database.execute<{ table_name: string }>(sql`
    select table_name from information_schema.tables where table_schema = 'public'
  `);
  // Ordena no JS para não depender da collation do banco.
  return result.rows.map((row) => row.table_name).sort();
}

describe("migrateDatabase", () => {
  let centralBeforeTables: string[] = [];
  let firstVersion = "";

  beforeAll(async () => {
    centralBeforeTables = await centralTables();
    await connected(serverUrl(), (client) => client.query(`create database ${escapeIdentifier(dbName)}`));
  });

  afterAll(async () => {
    await connected(serverUrl(), (client) =>
      client.query(`drop database if exists ${escapeIdentifier(dbName)} with (force)`),
    );
  });

  it("PD-16: migrateDatabase cria as tabelas municipais num banco vazio", async () => {
    const { version } = await migrateDatabase(tenantUrl, "municipal");
    firstVersion = version;
    expect(version).toBe(LAST_MUNICIPAL);

    await connected(tenantUrl, async (tenant) => {
      const columns = await tenant.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(
        `select column_name, data_type, is_nullable
         from information_schema.columns
         where table_schema = 'public' and table_name = 'local_person'`,
      );
      const byName = Object.fromEntries(
        columns.rows.map((c) => [c.column_name, { kind: c.data_type, null: c.is_nullable === "YES" }]),
      );
      expect(byName).toEqual({
        id: { kind: "uuid", null: false },
        name: { kind: "text", null: false },
        birth_date: { kind: "date", null: false },
        cpf: { kind: "text", null: true },
        patient_id: { kind: "text", null: true },
        document_verified_by: { kind: "text", null: true },
        document_verified_at: { kind: "timestamp with time zone", null: true },
        created_at: { kind: "timestamp with time zone", null: false },
      });

      // Índice único parcial: várias pessoas sem CPF convivem, o mesmo CPF duas vezes não.
      await tenant.query(
        "insert into local_person (name, birth_date) values ('Ana', '1990-01-01'), ('Bia', '1991-02-02')",
      );
      await tenant.query(
        "insert into local_person (name, birth_date, cpf) values ('Caio', '1980-03-03', '12345678909')",
      );
      await expect(
        tenant.query("insert into local_person (name, birth_date, cpf) values ('Davi', '1981-04-04', '12345678909')"),
      ).rejects.toThrow(/duplicate key/);
    });
  });

  it("PD-16: migrar de novo não muda nada", async () => {
    const { version } = await migrateDatabase(tenantUrl, "municipal");
    expect(version).toBe(firstVersion);

    await connected(tenantUrl, async (tenant) => {
      const applied = await tenant.query("select 1 from drizzle.__drizzle_migrations");
      expect(applied.rowCount).toBe(MIGRATIONS_MUNICIPAL);
      const people = await tenant.query("select 1 from local_person");
      expect(people.rowCount).toBe(3);
    });
  });

  it("INV-11: schema municipal não cria tabela no central", async () => {
    const afterTables = await centralTables();
    expect(afterTables).toEqual(centralBeforeTables);
    expect(afterTables).not.toContain("local_person");
  });

  it("PD-16: journal sem migrations dá erro claro", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "fila-journal-"));
    try {
      await mkdir(path.join(folder, "meta"));
      await writeFile(
        path.join(folder, "meta", "_journal.json"),
        JSON.stringify({ version: "7", dialect: "postgresql", entries: [] }),
      );
      await expect(migrateDatabase(tenantUrl, "municipal", { folder })).rejects.toThrow(
        /nenhuma migração no journal de municipal/,
      );
    } finally {
      await rm(folder, { recursive: true, force: true });
    }
  });
  async function withFakeMigration(createdAt: number, fn: () => Promise<void>) {
    const insert = "insert into drizzle.__drizzle_migrations (hash, created_at) values ('fora', $1)";
    await connected(tenantUrl, (client) => client.query(insert, [createdAt]));
    try {
      await fn();
    } finally {
      await connected(tenantUrl, (client) =>
        client.query("delete from drizzle.__drizzle_migrations where hash = 'fora'"),
      );
    }
  }

  it("NC2: banco com migração anterior ao journal (conjunto antigo) é recusado com mensagem clara", () =>
    withFakeMigration(1, () => expect(migrateDatabase(tenantUrl, "municipal")).rejects.toThrow(/recrie o banco/)));

  it("NC2: banco à frente do código (migração mais nova que o journal) não manda recriar", () =>
    withFakeMigration(Date.now() + 86400_000, async () => {
      const r = await migrateDatabase(tenantUrl, "municipal").catch((e: Error) => e);
      expect(r instanceof Error ? r.message : "").not.toMatch(/recrie/);
    }));
});
