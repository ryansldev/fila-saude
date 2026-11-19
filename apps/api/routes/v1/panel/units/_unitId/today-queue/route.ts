import { todayQueueSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { todayQueue } from "infra/queue/panel";

// Fila do dia (caminho C): a unidade inteira, para quem é da equipe dela (F1).
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Fila do dia da unidade",
    params: idParams("unitId"),
    response: { 200: todayQueueSchema },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .get("/", { schema }, async (req) => todayQueue(await panelContext(req), req.params.unitId));
}
