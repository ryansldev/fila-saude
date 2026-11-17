import { questionnaireInputSchema, redoneQuestionnaireSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { redoPatientQuestionnaire } from "infra/queue/waitlist";

// RN-RISCO-03 / RN-PIORA-01: refazer o questionário na lista ou na fila do dia, ainda em casa.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req) => {
    const { db, patient } = patientOf(req);
    const { answers } = validate(questionnaireInputSchema, req.body);
    return validate(
      redoneQuestionnaireSchema,
      await redoPatientQuestionnaire(db, patient.patientId, pathId(req, "entryId"), answers, Date.now()),
    );
  });
}
