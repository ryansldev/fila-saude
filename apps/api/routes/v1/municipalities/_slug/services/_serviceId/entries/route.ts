import { signUpInputSchema, signUpSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { apiErrors, idSchema, PATIENT, SIGN_UP_ERRORS, slugParams, TAGS } from "infra/openapi/schemas";
import { joinWaitlistFromApp } from "infra/queue/waitlist";

// T5.1: entrar na lista de espera do serviço pelo app.
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preValidation: [app.requirePatient],
      schema: {
        tags: [TAGS.patient],
        summary: "Entrar na lista de espera do serviço",
        security: PATIENT,
        params: slugParams.extend({ serviceId: idSchema }),
        body: signUpInputSchema,
        response: {
          201: signUpSchema,
          ...apiErrors(...SIGN_UP_ERRORS),
        },
      },
    },
    async (req, reply) => {
      const { db, patient } = patientOf(req);
      const r = await joinWaitlistFromApp(db, patient, req.params.serviceId, req.body, Date.now());
      return reply.code(201).send(r);
    },
  );
}
