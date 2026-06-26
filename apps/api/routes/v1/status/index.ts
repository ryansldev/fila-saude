import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import database from "infra/database";

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async () => {
    const resultDatabaseVersion = await database.execute(sql`SHOW server_version;`)
    const databaseVersion = resultDatabaseVersion.rows[0]?.server_version ?? null

    return {
      dependencies: {
        database: {
          version: databaseVersion
        }
      }
    }
  });
}