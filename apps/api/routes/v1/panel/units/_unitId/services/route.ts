import { serviceInputSchema, serviceSchema } from "@fila-saude/schemas/service";
import type { FastifyInstance } from "fastify";
import { CONFIGURE, pathId } from "infra/config/common";
import { createService, listServices } from "infra/config/services";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { require } from "infra/panel/guard";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: CONFIGURE } }, async (req, reply) => {
    const data = validate(serviceInputSchema, req.body);
    const s = await createService(await panelContext(req), pathId(req, "unitId"), data);
    return reply.status(201).send(validate(serviceSchema, s));
  });

  app.get("/", { preHandler: require(CONFIGURE, { unit: (req) => pathId(req, "unitId") }) }, async (req) =>
    listServices(await panelContext(req), pathId(req, "unitId")),
  );
}
