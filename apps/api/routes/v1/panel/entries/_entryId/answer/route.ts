import { registeredAnswerSchema, schedulerAnswerSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { answerByScheduler, SCHEDULE } from "infra/queue/scheduling";

// RN-CONF-02: confirmou, recusou ou sem contato, registrado pelo agendador depois de ligar.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: SCHEDULE } }, async (req) => {
    const { answer } = validate(schedulerAnswerSchema, req.body);
    return validate(
      registeredAnswerSchema,
      await answerByScheduler(await panelContext(req), pathId(req, "entryId"), answer),
    );
  });
}
