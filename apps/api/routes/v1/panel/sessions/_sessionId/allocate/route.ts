import { allocateInputSchema, sessionAllocationSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFLICT_CODES, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { allocateSession, SCHEDULE } from "infra/queue/scheduling";

// T5.3 / RN-AL-04: o agendador aloca; o segundo a chegar recebe 409 com a lista atualizada (I7).
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Alocar uma entrada na sessão",
    params: idParams("sessionId"),
    body: allocateInputSchema,
    response: { 200: sessionAllocationSchema },
    errors: { 404: ["not_found"], 409: CONFLICT_CODES },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { config: { action: SCHEDULE }, schema }, async (req) =>
      allocateSession(await panelContext(req), req.params.sessionId, req.body.entryId),
    );
}
