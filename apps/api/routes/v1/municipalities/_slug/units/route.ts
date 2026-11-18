import { publicUnitSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { apiErrors, slugParams, TAGS, TENANT_ERRORS } from "infra/openapi/schemas";
import { municipalityUnits } from "infra/queue/app";
import { publicTenantDb } from "infra/tenant/public";
import z from "zod";

// Tela 5: pública, como a agenda (sem dado de paciente).
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: {
        tags: [TAGS.municipality],
        summary: "Unidades do município",
        params: slugParams,
        response: { 200: z.array(publicUnitSchema), ...apiErrors(TENANT_ERRORS) },
      },
    },
    async (req) => municipalityUnits(publicTenantDb(req), Date.now()),
  );
}
