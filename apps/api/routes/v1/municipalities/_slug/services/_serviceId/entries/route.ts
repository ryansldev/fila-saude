import { signUpInputSchema, signUpSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { joinWaitlistFromApp } from "infra/queue/waitlist";

// T5.1: entrar na lista de espera do serviço pelo app.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req, reply) => {
    const { db, patient } = patientOf(req);
    const r = await joinWaitlistFromApp(
      db,
      patient,
      pathId(req, "serviceId"),
      validate(signUpInputSchema, req.body),
      Date.now(),
    );
    return reply.code(201).send(validate(signUpSchema, r));
  });
}
