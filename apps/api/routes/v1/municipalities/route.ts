import { publicMunicipalitySchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { validate } from "infra/errors";
import { activeMunicipalities } from "infra/queue/app";
import z from "zod";

// O app escolhe o município (AD-028: um app só para todos).
export default async function (app: FastifyInstance) {
  app.get("/", async () => validate(z.array(publicMunicipalitySchema), await activeMunicipalities()));
}
