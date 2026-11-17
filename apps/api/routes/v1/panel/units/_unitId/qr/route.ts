import { unitQrSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { ApiError, validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { unitQr } from "infra/queue/qr";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) => {
    const ctx = await panelContext(req);
    if (!req.tenant) throw new ApiError(404, "unknown_municipality");
    return validate(unitQrSchema, await unitQr(ctx, req.tenant.slug, pathId(req, "unitId")));
  });
}
