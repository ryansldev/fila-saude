import { leavingSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { apiErrors, ENTRY_COMMAND_ERRORS, entryParams, PATIENT, TAGS } from "infra/openapi/schemas";
import { patientLeaving } from "infra/queue/app";

// RN-PRES-02: "Vou sair", de qualquer lugar, só pela conta responsável pela entrada.
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preValidation: [app.requirePatient],
      schema: {
        tags: [TAGS.patient],
        summary: "Vou sair da unidade",
        security: PATIENT,
        params: entryParams,
        response: { 200: leavingSchema, ...apiErrors(...ENTRY_COMMAND_ERRORS) },
      },
    },
    async (req) => {
      const { db, patient } = patientOf(req);
      return patientLeaving(db, patient.patientId, req.params.entryId, Date.now());
    },
  );
}
