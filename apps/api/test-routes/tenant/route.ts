import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

// PD-19 / PD-15: rota só de teste que mostra em qual banco a requisição caiu.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: app.requireTenant }, async (req) => {
    const tenant = req.tenant;
    if (!tenant) throw new Error("requireTenant deixou passar sem tenant");
    const result = await tenant.db.execute<{ database: string }>(sql`select current_database() as database`);
    return { slug: tenant.slug, database: result.rows[0]?.database };
  });
}
