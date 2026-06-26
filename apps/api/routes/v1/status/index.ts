import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import database from "infra/database";

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async () => {
    const updatedAt = new Date().toISOString();

    const databaseResult = await database.transaction(async (tx) => {
      const databaseVersionResult = await tx.execute<{ server_version: string }>(sql`SHOW server_version;`)
      const databaseMaxConnectionsResult = await tx.execute<{ max_connections: number }>(sql`SHOW max_connections;`)
      const databaseConnectionsResult = await tx.execute<{ count: number }>(sql`SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database();`)

      return {
        version: databaseVersionResult.rows,
        maxConnections: databaseMaxConnectionsResult.rows,
        openedConnections: databaseConnectionsResult.rows,
      };
    })
    
    const databaseVersion = databaseResult.version[0]?.server_version ?? null;
    const databaseMaxConnections = Number(databaseResult.maxConnections[0]?.max_connections ?? null);
    const databaseOpenedConnections = databaseResult.openedConnections[0]?.count ?? null;

    return {
      updated_at: updatedAt,
      dependencies: {
        database: {
          version: databaseVersion,
          max_connections: databaseMaxConnections,
          opened_connections: databaseOpenedConnections,
        },
      }
    }
  });
}