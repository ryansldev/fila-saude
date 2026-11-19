import { statusSchema } from "@fila-saude/schemas/status";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import database, { pool } from "infra/database";
import { TAGS } from "infra/openapi/schemas";

export default async function (app: FastifyInstance) {
  const schema = { tags: [TAGS.system], summary: "Saúde da API", response: { 200: statusSchema } };
  app.withTypeProvider<ZodTypeProvider>().get("/", { schema }, async () => {
    const updatedAt = new Date().toISOString();

    const databaseResult = await database.transaction(async (tx) => {
      const databaseVersionResult = await tx.execute<{
        server_version: string;
      }>(sql`SHOW server_version;`);
      const databaseMaxConnectionsResult = await tx.execute<{
        max_connections: number;
      }>(sql`SHOW max_connections;`);

      return {
        version: databaseVersionResult.rows,
        maxConnections: databaseMaxConnectionsResult.rows,
      };
    });

    const databaseVersion = databaseResult.version[0]?.server_version ?? null;
    const databaseMaxConnections = Number(databaseResult.maxConnections[0]?.max_connections ?? null);

    return statusSchema.parse({
      updated_at: updatedAt,
      dependencies: {
        database: {
          version: databaseVersion,
          connections: {
            max: databaseMaxConnections,
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount,
          },
        },
      },
    });
  });
}
