import { checkInInputSchema, checkInSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { apiErrors, PATIENT, PATIENT_IN_MUNICIPALITY_ERRORS, slugParams, TAGS } from "infra/openapi/schemas";
import { patientCheckIn } from "infra/queue/qr";

// RN-PRES-01: check-in pelo QR, só com a conta do paciente (RNF-SEG-01).
export default async function (app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/",
    {
      preValidation: [app.requirePatient],
      schema: {
        tags: [TAGS.patient],
        summary: "Check-in pelo QR da unidade",
        security: PATIENT,
        params: slugParams,
        body: checkInInputSchema,
        response: {
          200: checkInSchema,
          ...apiErrors(...PATIENT_IN_MUNICIPALITY_ERRORS, { 400: ["invalid_input"], 409: ["…códigos do domínio"] }),
        },
      },
    },
    async (req) => {
      const { db, patient } = patientOf(req);
      return patientCheckIn(db, patient, req.body.unitId, req.body.tokens, Date.now());
    },
  );
}
