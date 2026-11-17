import { staffUserInputSchema, staffUserSchema } from "@fila-saude/schemas/user";
import type { FastifyInstance } from "fastify";
import { STAFF } from "infra/config/common";
import { createUser, listUsers } from "infra/config/users";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { requireLogin } from "infra/panel/guard";

// T2.2 / RN-PERF-04: a equipe do painel, com ocupações e funções.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: STAFF } }, async (req, reply) => {
    const data = validate(staffUserInputSchema, req.body);
    const u = await createUser(await panelContext(req), data);
    return reply.status(201).send(validate(staffUserSchema, u));
  });

  app.get("/", { preHandler: requireLogin }, async (req) => listUsers(await panelContext(req)));
}
