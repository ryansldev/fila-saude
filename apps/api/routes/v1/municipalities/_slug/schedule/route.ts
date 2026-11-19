import { scheduleSessionSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { apiErrors, slugParams, TAGS, TENANT_ERRORS } from "infra/openapi/schemas";
import { schedule } from "infra/queue/app";
import { publicTenantDb } from "infra/tenant/public";
import z from "zod";

// T3.2: pública; `unitId` restringe à agenda de uma unidade (a página da unidade no app).
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: {
        tags: [TAGS.municipality],
        summary: "Agenda pública do município",
        params: slugParams,
        querystring: z.object({ unitId: z.uuid().optional() }),
        response: {
          200: z.array(scheduleSessionSchema),
          ...apiErrors(TENANT_ERRORS, { 400: ["invalid_input"] }),
        },
      },
    },
    async (req) => schedule(publicTenantDb(req), Date.now(), req.query.unitId),
  );
}
