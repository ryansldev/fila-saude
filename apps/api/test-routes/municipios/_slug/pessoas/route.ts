import { asc } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import { validar } from "infra/erros";
import { z } from "zod";

// PD-19 / T1.7: rota só de teste que grava e lista `pessoa_local` no banco do município resolvido
// (`/v1/teste/municipios/:slug/pessoas`), para provar que A e B nunca se enxergam.
const novaPessoa = z.object({ nome: z.string().min(1), nascimento: z.iso.date() });

function tenantDe(req: FastifyRequest) {
  if (!req.tenant) throw new Error("exigirTenant deixou passar sem tenant");
  return req.tenant;
}

export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: app.exigirTenant }, async (req, reply) => {
    const corpo = validar(novaPessoa, req.body);
    const [criada] = await tenantDe(req).db.insert(pessoaLocal).values(corpo).returning();
    return reply.status(201).send(criada);
  });

  app.get("/", { preHandler: app.exigirTenant }, async (req) => {
    return tenantDe(req).db.select().from(pessoaLocal).orderBy(asc(pessoaLocal.criadoEm));
  });
}
