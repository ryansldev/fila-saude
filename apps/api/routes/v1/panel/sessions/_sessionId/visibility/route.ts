import { sessionSchema, visibilityInputSchema } from "@fila-saude/schemas/session";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SESSION } from "infra/config/common";
import { changeSessionVisibility } from "infra/config/sessions";
import { DOMAIN_CONFLICT, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Mudar a visibilidade da sessão",
    params: idParams("sessionId"),
    body: visibilityInputSchema,
    response: { 200: sessionSchema },
    errors: { 404: ["not_found"], 409: DOMAIN_CONFLICT },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { config: { action: SESSION }, schema }, async (req) =>
      changeSessionVisibility(await panelContext(req), req.params.sessionId, req.body),
    );
}
