import { Client, escapeIdentifier } from "pg";

// `CREATE DATABASE` não roda em transação e segura a conexão enquanto copia o template; por isso vai por um
// cliente próprio ligado ao banco `postgres` do mesmo servidor, nunca pelo pool do central.
export async function createDatabaseIfMissing(serverUrl: string, database: string): Promise<void> {
  const url = new URL(serverUrl);
  url.pathname = "/postgres";
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const exists = await client.query("select 1 from pg_database where datname = $1", [database]);
    if (exists.rowCount === 1) return;
    try {
      await client.query(`create database ${escapeIdentifier(database)}`);
    } catch (error) {
      // Alguém criou entre a consulta e o CREATE; o resultado é o mesmo. O Postgres responde 42P04
      // (duplicate_database) ou, se as duas criações correm juntas, 23505 no índice de `pg_database`.
      const code = (error as { code?: unknown }).code;
      if (code !== "42P04" && code !== "23505") throw error;
    }
  } finally {
    await client.end();
  }
}
