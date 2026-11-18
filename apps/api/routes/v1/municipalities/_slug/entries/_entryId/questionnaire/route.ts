import { questionnaireInputSchema, redoneQuestionnaireSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { apiErrors, ENTRY_COMMAND_ERRORS, entryParams, PATIENT, TAGS } from "infra/openapi/schemas";
import { redoPatientQuestionnaire } from "infra/queue/waitlist";

// RN-RISCO-03 / RN-PIORA-01: refazer o questionário na lista ou na fila do dia, ainda em casa.
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preValidation: [app.requirePatient],
      schema: {
        tags: [TAGS.patient],
        summary: "Refazer o questionário",
        security: PATIENT,
        params: entryParams,
        body: questionnaireInputSchema,
        response: { 200: redoneQuestionnaireSchema, ...apiErrors(...ENTRY_COMMAND_ERRORS, { 400: ["invalid_input"] }) },
      },
    },
    async (req) => {
      const { db, patient } = patientOf(req);
      return redoPatientQuestionnaire(db, patient.patientId, req.params.entryId, req.body.answers, Date.now());
    },
  );
}
