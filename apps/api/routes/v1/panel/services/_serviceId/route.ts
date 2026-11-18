import { serviceEditSchema, serviceSchema } from "@fila-saude/schemas/service";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFIGURE } from "infra/config/common";
import { editService } from "infra/config/services";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Editar o serviço",
    params: idParams("serviceId"),
    body: serviceEditSchema,
    response: { 200: serviceSchema },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .patch("/", { config: { action: CONFIGURE }, schema }, async (req) =>
      editService(await panelContext(req), req.params.serviceId, req.body),
    );
}
