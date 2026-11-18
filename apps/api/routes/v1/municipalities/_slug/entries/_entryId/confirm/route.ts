import { registeredAnswerSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { apiErrors, ENTRY_COMMAND_ERRORS, entryParams, PATIENT, TAGS } from "infra/openapi/schemas";
import { patientAnswer } from "infra/queue/waitlist";

// RN-CONF-01/04: resposta à alocação pelo app, só da conta responsável.
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preValidation: [app.requirePatient],
      schema: {
        tags: [TAGS.patient],
        summary: "Confirmar a vaga",
        security: PATIENT,
        params: entryParams,
        response: { 200: registeredAnswerSchema, ...apiErrors(...ENTRY_COMMAND_ERRORS) },
      },
    },
    async (req) => {
      const { db, patient } = patientOf(req);
      return patientAnswer(db, patient.patientId, req.params.entryId, "confirmed", Date.now());
    },
  );
}
