import { scheduleSessionSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { validate } from "infra/errors";
import { schedule } from "infra/queue/app";
import { publicTenantDb } from "infra/tenant/public";
import z from "zod";

// T3.2: pública; `unitId` restringe à agenda de uma unidade (a página da unidade no app).
const querySchema = z.object({ unitId: z.uuid().optional() });

export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireTenant] }, async (req) => {
    const { unitId } = validate(querySchema, req.query);
    return validate(z.array(scheduleSessionSchema), await schedule(publicTenantDb(req), Date.now(), unitId));
  });
}
