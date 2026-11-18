import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { canSeeUnit, unitConfig } from "infra/config/units";
import { ApiError } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { requireLogin } from "infra/panel/guard";

// PD-28 / PD-35: configuração efetiva com a origem de cada valor.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: requireLogin }, async (req) => {
    const ctx = await panelContext(req);
    const id = pathId(req, "unitId");
    if (!canSeeUnit(ctx, id)) throw new ApiError(403, "no_permission");
    return unitConfig(ctx, id);
  });
}
