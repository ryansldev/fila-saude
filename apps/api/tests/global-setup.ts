// PD-19: roda uma vez antes da suíte, no processo principal do Vitest.
// Cria e migra `fila_central` e apaga bancos `fila_t_%` deixados por execuções antigas.
export default async function setup() {
  process.env.NODE_ENV ??= "test";

  const { default: env } = await import("../infra/env");
  const { createDatabaseIfMissing } = await import("../infra/database/create-database");
  const { migrateDatabase } = await import("../infra/database/migrate");
  const { Client, escapeIdentifier } = await import("pg");

  await createDatabaseIfMissing(env.DATABASE_URL, env.POSTGRES_DB);

  const server = new URL(env.DATABASE_URL);
  server.pathname = "/postgres";
  const admin = new Client({ connectionString: server.toString() });
  await admin.connect();
  try {
    const leftovers = await admin.query<{ datname: string }>(
      "select datname from pg_database where datname like 'fila\\_t\\_%'",
    );
    for (const { datname } of leftovers.rows) {
      await admin.query(`drop database if exists ${escapeIdentifier(datname)} with (force)`);
    }
  } finally {
    await admin.end();
  }

  // O mesmo runner do `db:migrate` (PD-16), então o conjunto central passa por ele em toda execução.
  await migrateDatabase(env.DATABASE_URL, "central");
}
