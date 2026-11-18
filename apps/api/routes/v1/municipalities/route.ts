import { publicMunicipalitySchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { TAGS } from "infra/openapi/schemas";
import { activeMunicipalities } from "infra/queue/app";
import z from "zod";

// O app escolhe o município (AD-028: um app só para todos).
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      schema: {
        tags: [TAGS.municipality],
        summary: "Municípios ativos",
        response: { 200: z.array(publicMunicipalitySchema) },
      },
    },
    async () => activeMunicipalities(),
  );
}
