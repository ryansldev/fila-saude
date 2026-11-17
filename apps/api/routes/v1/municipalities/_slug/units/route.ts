import { publicUnitSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { validate } from "infra/errors";
import { municipalityUnits } from "infra/queue/app";
import { publicTenantDb } from "infra/tenant/public";
import z from "zod";

// Tela 5: pública, como a agenda (sem dado de paciente).
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireTenant] }, async (req) => {
    return validate(z.array(publicUnitSchema), await municipalityUnits(publicTenantDb(req), Date.now()));
  });
}
