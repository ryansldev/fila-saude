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

async function clearDatabase() {
  await database.execute(sql`drop schema public cascade; create schema public;`);
}

const orquestrator = {
  waitForAllServices,
  clearDatabase,
};

export default orquestrator;
