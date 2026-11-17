import { publicUnitSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { ApiError, validate } from "infra/errors";
import { municipalityUnits } from "infra/queue/app";
import z from "zod";

// Tela 5: pública, como a agenda (sem dado de paciente).
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireTenant] }, async (req) => {
    if (!req.tenant) throw new ApiError(404, "unknown_municipality");
    return validate(z.array(publicUnitSchema), await municipalityUnits(req.tenant.db, Date.now()));
  });
}
