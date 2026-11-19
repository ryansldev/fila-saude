import { sessionSchema } from "@fila-saude/schemas/session";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SESSION } from "infra/config/common";
import { cancelSession } from "infra/config/sessions";
import { CONFLICT_CODES, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Cancelar a sessão",
    params: idParams("sessionId"),
    response: { 200: sessionSchema },
    errors: { 404: ["not_found"], 409: CONFLICT_CODES },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { config: { action: SESSION }, schema }, async (req) =>
      cancelSession(await panelContext(req), req.params.sessionId),
    );
}
