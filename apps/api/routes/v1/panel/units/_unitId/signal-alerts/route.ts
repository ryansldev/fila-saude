import { signalAlertSchema } from "@fila-saude/schemas/unit";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { unitSignalAlerts } from "infra/queue/signal";
import z from "zod";

// QP2: a faixa do painel quando a TV ou uma estação aberta perde o sinal.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "TV e estações sem sinal na unidade",
    params: idParams("unitId"),
    response: { 200: z.array(signalAlertSchema) },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .get("/", { schema }, async (req) => unitSignalAlerts(await panelContext(req), req.params.unitId));
}
