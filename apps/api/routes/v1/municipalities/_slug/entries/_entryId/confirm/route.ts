import { registeredAnswerSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { patientAnswer } from "infra/queue/waitlist";

// RN-CONF-01/04: resposta à alocação pelo app, só da conta responsável.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req) => {
    const { db, patient } = patientOf(req);
    return validate(
      registeredAnswerSchema,
      await patientAnswer(db, patient.patientId, pathId(req, "entryId"), "confirmed", Date.now()),
    );
  });
}
