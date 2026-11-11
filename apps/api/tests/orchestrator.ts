import retry from "async-retry";
import { sql } from "drizzle-orm";
import database from "infra/database";
import webserver from "infra/webserver";

async function waitForAllServices() {
  await waitForWebServer();

  async function waitForWebServer() {
    return retry(fetchStatusPage, {
      retries: 100,
      maxTimeout: 1000,
    });

    async function fetchStatusPage() {
      const response = await fetch(`${webserver.origin}/v1/status`);

      if (response.status !== 200) {
        throw Error();
      }
    }
  }
}

// Limpa os dados do central sem mexer no schema: as migrations já foram aplicadas pelo global-setup.
async function clearDatabase() {
  const tabelas = await database.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  );
  if (tabelas.rows.length === 0) return;

  const lista = sql.join(
    tabelas.rows.map((linha) => sql.identifier(linha.tablename)),
    sql`, `,
  );
  await database.execute(sql`truncate table ${lista} cascade`);
}

const orquestrator = {
  waitForAllServices,
  clearDatabase,
};

export default orquestrator;
