import { unitEditSchema, unitSchema } from "@fila-saude/schemas/unit";
import type { FastifyInstance } from "fastify";
import { pathId, UNITS_AND_RULES } from "infra/config/common";
import { canSeeUnit, editUnit, readUnit, removeUnit } from "infra/config/units";
import { ApiError, validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { requireLogin } from "infra/panel/guard";

export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: requireLogin }, async (req) => {
    const ctx = await panelContext(req);
    const id = pathId(req, "unitId");
    if (!canSeeUnit(ctx, id)) throw new ApiError(403, "no_permission");
    return readUnit(ctx, id);
  });

  app.patch("/", { config: { action: UNITS_AND_RULES } }, async (req) => {
    const data = validate(unitEditSchema, req.body);
    const u = await editUnit(await panelContext(req), pathId(req, "unitId"), data);
    return validate(unitSchema, u);
  });

  app.delete("/", { config: { action: UNITS_AND_RULES } }, async (req, reply) => {
    await removeUnit(await panelContext(req), pathId(req, "unitId"));
    return reply.status(204).send();
  });
}
