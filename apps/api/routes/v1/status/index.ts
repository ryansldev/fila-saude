import database from "api/infra/database";
import { sql } from "drizzle-orm";

export default async function (fastify) {
  fastify.get('/', async () => {
    const resultDatabaseVersion = await database.execute(sql`SHOW server_version;`)
    const databaseVersion = resultDatabaseVersion.rows[0].server_version

    return {
      dependencies: {
        database: {
          version: databaseVersion
        }
      }
    }
  });
}