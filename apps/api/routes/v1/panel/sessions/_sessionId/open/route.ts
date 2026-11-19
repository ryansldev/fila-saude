import { sessionQueueSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { SESSION } from "infra/config/common";
import { CONFLICT_CODES, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { openDaySession } from "infra/queue/panel";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Abrir a sessão do dia",
    params: idParams("sessionId"),
    response: { 200: sessionQueueSchema },
    errors: { 404: ["not_found"], 409: CONFLICT_CODES },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { config: { action: SESSION }, schema }, async (req) =>
      openDaySession(await panelContext(req), req.params.sessionId),
    );
}
