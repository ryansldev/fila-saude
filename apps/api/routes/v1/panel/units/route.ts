import { unitInputSchema, unitSchema } from "@fila-saude/schemas/unit";
import type { FastifyInstance } from "fastify";
import { UNITS_AND_RULES } from "infra/config/common";
import { createUnit, listUnits } from "infra/config/units";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { requireLogin } from "infra/panel/guard";

// T2.2: unidades do município.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: UNITS_AND_RULES } }, async (req, reply) => {
    const data = validate(unitInputSchema, req.body);
    const u = await createUnit(await panelContext(req), data);
    return reply.status(201).send(validate(unitSchema, u));
  });

  app.get("/", { preHandler: requireLogin }, async (req) => listUnits(await panelContext(req)));
}
