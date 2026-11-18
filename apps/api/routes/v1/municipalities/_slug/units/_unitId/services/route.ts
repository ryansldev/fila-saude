import { unitServiceSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { apiErrors, idSchema, PATH_ID_ERRORS, slugParams, TAGS, TENANT_ERRORS } from "infra/openapi/schemas";
import { unitServices } from "infra/queue/waitlist";
import { publicTenantDb } from "infra/tenant/public";
import z from "zod";

// I1: pública, como a agenda (sem dado de paciente).
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: {
        tags: [TAGS.municipality],
        summary: "Serviços da unidade",
        params: slugParams.extend({ unitId: idSchema }),
        response: {
          200: z.array(unitServiceSchema),
          ...apiErrors(TENANT_ERRORS, PATH_ID_ERRORS),
        },
      },
    },
    async (req) => unitServices(publicTenantDb(req), req.params.unitId),
  );
}
