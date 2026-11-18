import { serviceWaitlistSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { unitWaitlist } from "infra/queue/scheduling";
import z from "zod";

// T5.3: lista de espera da unidade por serviço, com as sessões privadas que vêm.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Lista de espera da unidade",
    params: idParams("unitId"),
    response: { 200: z.array(serviceWaitlistSchema) },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .get("/", { schema }, async (req) => unitWaitlist(await panelContext(req), req.params.unitId));
}
