import { signUpInputSchema, signUpSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { patientOf } from "infra/auth/patient-session";
import { CAPTCHA_HEADER, checkCaptcha } from "infra/captcha";
import { ApiError } from "infra/errors";
import { apiErrors, PATIENT, SIGN_UP_ERRORS, sessionParams, TAGS } from "infra/openapi/schemas";
import { signUpPatient } from "infra/queue/app";

export default async function (app: FastifyInstance) {
  const schema = {
    tags: [TAGS.patient],
    summary: "Inscrever-se numa sessão pública",
    security: PATIENT,
    params: sessionParams,
    body: signUpInputSchema,
    response: {
      201: signUpSchema,
      ...apiErrors(...SIGN_UP_ERRORS, { 400: ["captcha_required", "captcha_failed"], 503: ["captcha_unavailable"] }),
    },
  };
  // O corpo é conferido antes (pelo schema): um pedido inválido não gasta o token (que vale uma vez) na Cloudflare.
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { preValidation: [app.requirePatient], schema }, async (req, reply) => {
      const { db, patient } = patientOf(req);
      // RN-ID-07 / AD-062: só há inscrição pelo app em sessão pública, e ela pede o captcha.
      // Sem token é `captcha_required`; token recusado é `captcha_failed` (o app não reenvia sozinho).
      const token = req.headers[CAPTCHA_HEADER];
      const captcha = await checkCaptcha(typeof token === "string" ? token : null, req.ip);
      if (captcha === "missing")
        throw new ApiError(400, "captcha_required", undefined, "Confirme que você não é um robô para se inscrever.");
      if (captcha === "unavailable")
        throw new ApiError(
          503,
          "captcha_unavailable",
          undefined,
          "A verificação está fora do ar agora. Tente de novo daqui a pouco ou procure a recepção.",
        );
      if (captcha !== "ok") {
        throw new ApiError(
          400,
          "captcha_failed",
          undefined,
          "Não conseguimos confirmar que você não é um robô. Tente de novo ou procure a recepção.",
        );
      }
      const r = await signUpPatient(db, patient, req.params.sessionId, req.body, Date.now());
      return reply.code(201).send(r);
    });
}
