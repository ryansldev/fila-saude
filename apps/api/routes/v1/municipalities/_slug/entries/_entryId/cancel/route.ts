import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { pathId } from "infra/config/common";
import { cancelPatient } from "infra/queue/app";

// RN-CANC-01: "Não vou poder ir", só pela conta responsável pela entrada.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req) => {
    const { db, patient } = patientOf(req);
    return cancelPatient(db, patient.patientId, pathId(req, "entryId"), Date.now());
  });
}
