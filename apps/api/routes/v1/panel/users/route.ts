import { staffUserInputSchema, staffUserSchema } from "@fila-saude/schemas/user";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { STAFF } from "infra/config/common";
import { createUser, listUsers } from "infra/config/users";
import { CONFLICT_CODES, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import z from "zod";

// T2.2 / RN-PERF-04: a equipe do painel, com ocupações e funções.
export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const create = panelSchema({
    summary: "Criar pessoa na equipe",
    body: staffUserInputSchema,
    response: { 201: staffUserSchema },
    errors: { 409: CONFLICT_CODES },
  });
  typed.post("/", { config: { action: STAFF }, schema: create }, async (req, reply) =>
    reply.status(201).send(await createUser(await panelContext(req), req.body)),
  );
  const list = panelSchema({ summary: "Equipe do painel", response: { 200: z.array(staffUserSchema) } });
  typed.get("/", { schema: list }, async (req) => listUsers(await panelContext(req)));
}
