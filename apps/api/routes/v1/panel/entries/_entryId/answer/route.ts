import { registeredAnswerSchema, schedulerAnswerSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { DOMAIN_CONFLICT, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { answerByScheduler, SCHEDULE } from "infra/queue/scheduling";

// RN-CONF-02: confirmou, recusou ou sem contato, registrado pelo agendador depois de ligar.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Registrar a resposta do paciente à ligação",
    params: idParams("entryId"),
    body: schedulerAnswerSchema,
    response: { 200: registeredAnswerSchema },
    errors: { 404: ["not_found"], 409: DOMAIN_CONFLICT },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { config: { action: SCHEDULE }, schema }, async (req) =>
      answerByScheduler(await panelContext(req), req.params.entryId, req.body.answer),
    );
}
