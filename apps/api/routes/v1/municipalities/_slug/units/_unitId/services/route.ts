import { unitServiceSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { unitServices } from "infra/queue/waitlist";
import { publicTenantDb } from "infra/tenant/public";
import z from "zod";

// I1: pública, como a agenda (sem dado de paciente).
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireTenant] }, async (req) => {
    return validate(z.array(unitServiceSchema), await unitServices(publicTenantDb(req), pathId(req, "unitId")));
  });
}
