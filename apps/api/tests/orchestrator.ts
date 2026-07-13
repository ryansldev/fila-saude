import path from "node:path";
import { fileURLToPath } from "node:url";
import retry from "async-retry";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
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

async function clearDatabase() {
  await database.execute(sql`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    DROP SCHEMA IF EXISTS drizzle CASCADE;
  `);
}

async function runPendingMigrations() {
  await migrate(database, {
    migrationsFolder: path.join(path.dirname(fileURLToPath(import.meta.url)), "../infra/migrations"),
  });
}

const orquestrator = {
  waitForAllServices,
  clearDatabase,
  runPendingMigrations,
};

export default orquestrator;
