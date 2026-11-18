import { okSchema, signUpInputSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { apiErrors, PATIENT, SIGN_UP_ERRORS, sessionParams, TAGS } from "infra/openapi/schemas";
import { checkSignUp } from "infra/queue/app";

// Na escolha de "para quem", antes do questionário: recusa já o que a inscrição recusaria, sem gravar.
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preValidation: [app.requirePatient],
      schema: {
        tags: [TAGS.patient],
        summary: "Conferir a inscrição antes do questionário",
        security: PATIENT,
        params: sessionParams,
        body: signUpInputSchema.pick({ forWhom: true }),
        response: {
          200: okSchema,
          ...apiErrors(...SIGN_UP_ERRORS),
        },
      },
    },
    async (req) => {
      const { db, patient } = patientOf(req);
      return checkSignUp(db, patient, req.params.sessionId, req.body.forWhom, Date.now());
    },
  );
}
