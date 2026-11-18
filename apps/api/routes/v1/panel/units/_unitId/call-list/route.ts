import { callListItemSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { unitCallList } from "infra/queue/scheduling";
import z from "zod";

// RN-CONF-03: lista de ligação da unidade.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Lista de ligação da unidade",
    params: idParams("unitId"),
    response: { 200: z.array(callListItemSchema) },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .get("/", { schema }, async (req) => unitCallList(await panelContext(req), req.params.unitId));
}
