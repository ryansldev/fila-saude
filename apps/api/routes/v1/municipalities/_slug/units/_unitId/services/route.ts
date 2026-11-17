import { unitServiceSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { ApiError, validate } from "infra/errors";
import { unitServices } from "infra/queue/waitlist";
import z from "zod";

// I1: pública, como a agenda (sem dado de paciente).
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireTenant] }, async (req) => {
    if (!req.tenant) throw new ApiError(404, "unknown_municipality");
    return validate(z.array(unitServiceSchema), await unitServices(req.tenant.db, pathId(req, "unitId")));
  });
}
