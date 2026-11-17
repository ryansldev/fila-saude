import { scheduleSessionSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError, validate } from "infra/errors";
import { schedule } from "infra/queue/app";

function tenantDb(req: FastifyRequest) {
  if (!req.tenant) throw new ApiError(404, "unknown_municipality");
  return req.tenant.db;
}

import z from "zod";

export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireTenant] }, async (req) =>
    validate(z.array(scheduleSessionSchema), await schedule(tenantDb(req), Date.now())),
  );
}
