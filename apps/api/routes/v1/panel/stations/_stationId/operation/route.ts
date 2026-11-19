import { stationOperationSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { stationOperation } from "infra/queue/station";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Tela da estação",
    params: idParams("stationId"),
    response: { 200: stationOperationSchema },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .get("/", { schema }, async (req) => stationOperation(await panelContext(req), req.params.stationId));
}
