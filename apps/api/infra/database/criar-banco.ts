import { Client, escapeIdentifier } from "pg";

// `CREATE DATABASE` não roda em transação e segura a conexão enquanto copia o template; por isso vai por um
// cliente próprio ligado ao banco `postgres` do mesmo servidor, nunca pelo pool do central.
export async function criarBancoSeNaoExiste(urlDoServidor: string, banco: string): Promise<void> {
  const url = new URL(urlDoServidor);
  url.pathname = "/postgres";
  const cliente = new Client({ connectionString: url.toString() });
  await cliente.connect();
  try {
    const existe = await cliente.query("select 1 from pg_database where datname = $1", [banco]);
    if (existe.rowCount === 1) return;
    try {
      await cliente.query(`create database ${escapeIdentifier(banco)}`);
    } catch (erro) {
      // Alguém criou entre a consulta e o CREATE; o resultado é o mesmo. O Postgres responde 42P04
      // (duplicate_database) ou, se as duas criações correm juntas, 23505 no índice de `pg_database`.
      const codigo = (erro as { code?: unknown }).code;
      if (codigo !== "42P04" && codigo !== "23505") throw erro;
    }
  } finally {
    await cliente.end();
  }
}
