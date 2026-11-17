import type { FastifyInstance } from "fastify";
import { pathId, STAFF } from "infra/config/common";
import { removeUser } from "infra/config/users";
import { panelContext } from "infra/panel/action";

// RN-PERF-04: remover alguém da equipe.
export default async function (app: FastifyInstance) {
  app.delete("/", { config: { action: STAFF } }, async (req, reply) => {
    await removeUser(await panelContext(req), pathId(req, "userId"));
    return reply.status(204).send();
  });
}
