import { myEntrySchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { apiErrors, PATIENT, PATIENT_IN_MUNICIPALITY_ERRORS, slugParams, TAGS } from "infra/openapi/schemas";
import { mine } from "infra/queue/app";
import z from "zod";

// PD-33: o app consulta a cada ~3 s; mesmo formato que o WebSocket terá.
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    "/",
    {
      preValidation: [app.requirePatient],
      schema: {
        tags: [TAGS.patient],
        summary: "Minhas inscrições no município",
        security: PATIENT,
        params: slugParams,
        response: { 200: z.array(myEntrySchema), ...apiErrors(...PATIENT_IN_MUNICIPALITY_ERRORS) },
      },
    },
    async (req) => {
      const { db, patient } = patientOf(req);
      return mine(db, patient.patientId, Date.now());
    },
  );
}
