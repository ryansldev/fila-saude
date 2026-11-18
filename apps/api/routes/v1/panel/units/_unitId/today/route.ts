import { todayInUnitSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { todayInUnit } from "infra/queue/panel";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Hoje na unidade",
    params: idParams("unitId"),
    response: { 200: todayInUnitSchema },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .get("/", { schema }, async (req) => todayInUnit(await panelContext(req), req.params.unitId));
}
