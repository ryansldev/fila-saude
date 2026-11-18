import { checkInInputSchema, checkInSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { validate } from "infra/errors";
import { patientCheckIn } from "infra/queue/qr";

// RN-PRES-01: check-in pelo QR, só com a conta do paciente (RNF-SEG-01).
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req) => {
    const { db, patient } = patientOf(req);
    const { unitId, tokens } = validate(checkInInputSchema, req.body);
    return validate(checkInSchema, await patientCheckIn(db, patient, unitId, tokens, Date.now()));
  });
}
