import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { pathId } from "infra/config/common";
import { patientLeaving } from "infra/queue/app";

// RN-PRES-02: "Vou sair", de qualquer lugar, só pela conta responsável pela entrada.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req) => {
    const { db, patient } = patientOf(req);
    return patientLeaving(db, patient.patientId, pathId(req, "entryId"), Date.now());
  });
}
