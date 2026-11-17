import { serviceEditSchema, serviceSchema } from "@fila-saude/schemas/service";
import type { FastifyInstance } from "fastify";
import { CONFIGURE, pathId } from "infra/config/common";
import { editService } from "infra/config/services";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  app.patch("/", { config: { action: CONFIGURE } }, async (req) => {
    const data = validate(serviceEditSchema, req.body);
    return validate(serviceSchema, await editService(await panelContext(req), pathId(req, "serviceId"), data));
  });
}
