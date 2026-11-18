import { signUpInputSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { checkSignUp } from "infra/queue/app";

// Na escolha de "para quem", antes do questionário: recusa já o que a inscrição recusaria, sem gravar.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req) => {
    const { db, patient } = patientOf(req);
    const { forWhom } = validate(signUpInputSchema.pick({ forWhom: true }), req.body);
    return checkSignUp(db, patient, pathId(req, "sessionId"), forWhom, Date.now());
  });
}
