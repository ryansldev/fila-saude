import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { STAFF } from "infra/config/common";
import { removeUser } from "infra/config/users";
import { DOMAIN_CONFLICT, idParams, NO_CONTENT, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

// RN-PERF-04: remover alguém da equipe.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Remover alguém da equipe",
    params: idParams("userId"),
    response: { 204: NO_CONTENT },
    errors: { 404: ["not_found"], 409: DOMAIN_CONFLICT },
  });
  app.withTypeProvider<ZodTypeProvider>().delete("/", { config: { action: STAFF }, schema }, async (req, reply) => {
    await removeUser(await panelContext(req), req.params.userId);
    return reply.status(204).send(null);
  });
}
