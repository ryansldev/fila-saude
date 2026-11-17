import { myEntrySchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { validate } from "infra/errors";
import { mine } from "infra/queue/app";
import z from "zod";

// PD-33: o app consulta a cada ~3 s; mesmo formato que o SSE terá.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req) => {
    const { db, patient } = patientOf(req);
    return validate(z.array(myEntrySchema), await mine(db, patient.patientId, Date.now()));
  });
}
