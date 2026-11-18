import { sessionEditSchema, sessionSchema } from "@fila-saude/schemas/session";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFIGURE } from "infra/config/common";
import { editSession } from "infra/config/sessions";
import { DOMAIN_CONFLICT, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Editar a sessão",
    params: idParams("sessionId"),
    body: sessionEditSchema,
    response: { 200: sessionSchema },
    errors: { 404: ["not_found"], 409: DOMAIN_CONFLICT },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .patch("/", { config: { action: CONFIGURE }, schema }, async (req) =>
      editSession(await panelContext(req), req.params.sessionId, req.body),
    );
}
