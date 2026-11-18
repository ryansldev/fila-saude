import { serviceInputSchema, serviceSchema } from "@fila-saude/schemas/service";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFIGURE } from "infra/config/common";
import { createService, listServices } from "infra/config/services";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { canConfigureUnit } from "infra/panel/guard";
import z from "zod";

export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const params = idParams("unitId");
  const create = panelSchema({
    summary: "Criar serviço na unidade",
    params,
    body: serviceInputSchema,
    response: { 201: serviceSchema },
    errors: { 404: ["not_found"] },
  });
  typed.post("/", { config: { action: CONFIGURE }, schema: create }, async (req, reply) =>
    reply.status(201).send(await createService(await panelContext(req), req.params.unitId, req.body)),
  );
  const list = panelSchema({ summary: "Serviços da unidade", params, response: { 200: z.array(serviceSchema) } });
  typed.get("/", { preHandler: canConfigureUnit, schema: list }, async (req) =>
    listServices(await panelContext(req), req.params.unitId),
  );
}
