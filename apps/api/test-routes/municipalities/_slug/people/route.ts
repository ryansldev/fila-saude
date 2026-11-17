import { asc } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { localPerson } from "infra/database/municipal/schema/local-person";
import { validate } from "infra/errors";
import { z } from "zod";

// PD-19 / T1.7: rota só de teste que grava e lista `pessoa_local` no banco do município resolvido
// (`/v1/teste/municipios/:slug/pessoas`), para provar que A e B nunca se enxergam.
const newPerson = z.object({ name: z.string().min(1), birthDate: z.iso.date() });

function tenantOf(req: FastifyRequest) {
  if (!req.tenant) throw new Error("exigirTenant deixou passar sem tenant");
  return req.tenant;
}

export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: app.requireTenant }, async (req, reply) => {
    const body = validate(newPerson, req.body);
    const [created] = await tenantOf(req).db.insert(localPerson).values(body).returning();
    return reply.status(201).send(created);
  });

  app.get("/", { preHandler: app.requireTenant }, async (req) => {
    return tenantOf(req).db.select().from(localPerson).orderBy(asc(localPerson.createdAt));
  });
}
