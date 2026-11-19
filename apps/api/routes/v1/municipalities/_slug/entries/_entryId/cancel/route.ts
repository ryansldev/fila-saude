import { cancelledSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { apiErrors, ENTRY_COMMAND_ERRORS, entryParams, PATIENT, TAGS } from "infra/openapi/schemas";
import { cancelPatient } from "infra/queue/app";

// RN-CANC-01: "Não vou poder ir", só pela conta responsável pela entrada.
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preValidation: [app.requirePatient],
      schema: {
        tags: [TAGS.patient],
        summary: "Não vou poder ir",
        security: PATIENT,
        params: entryParams,
        response: { 200: cancelledSchema, ...apiErrors(...ENTRY_COMMAND_ERRORS) },
      },
    },
    async (req) => {
      const { db, patient } = patientOf(req);
      return cancelPatient(db, patient.patientId, req.params.entryId, Date.now());
    },
  );
}
