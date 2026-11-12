import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

// PD-19 / PD-15: rota só de teste que mostra em qual banco a requisição caiu.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: app.exigirTenant }, async (req) => {
    const tenant = req.tenant;
    if (!tenant) throw new Error("exigirTenant deixou passar sem tenant");
    const resultado = await tenant.db.execute<{ banco: string }>(sql`select current_database() as banco`);
    return { slug: tenant.slug, banco: resultado.rows[0]?.banco };
  });
}
