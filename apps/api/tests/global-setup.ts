import path from "node:path";
import { fileURLToPath } from "node:url";

// PD-19: roda uma vez antes da suíte, no processo principal do Vitest.
// Cria e migra `fila_central` e apaga bancos `fila_t_%` deixados por execuções antigas.
export default async function setup() {
  process.env.NODE_ENV ??= "test";

  const { default: env } = await import("../infra/env");
  const { Client, escapeIdentifier } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  const servidor = new URL(env.DATABASE_URL);
  servidor.pathname = "/postgres";
  const admin = new Client({ connectionString: servidor.toString() });
  await admin.connect();

  try {
    const existe = await admin.query("select 1 from pg_database where datname = $1", [env.POSTGRES_DB]);
    if (existe.rowCount === 0) {
      await admin.query(`create database ${escapeIdentifier(env.POSTGRES_DB)}`);
    }

    const sobras = await admin.query<{ datname: string }>(
      "select datname from pg_database where datname like 'fila\\_t\\_%'",
    );
    for (const { datname } of sobras.rows) {
      await admin.query(`drop database if exists ${escapeIdentifier(datname)} with (force)`);
    }
  } finally {
    await admin.end();
  }

  const central = new Client({ connectionString: env.DATABASE_URL });
  await central.connect();
  try {
    const migrationsFolder = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../infra/database/central/migrations",
    );
    await migrate(drizzle(central), { migrationsFolder });
  } finally {
    await central.end();
  }
}
