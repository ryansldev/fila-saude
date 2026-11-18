import { signUpInputSchema, signUpSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { CAPTCHA_HEADER, checkCaptcha } from "infra/captcha";
import { pathId } from "infra/config/common";
import { ApiError, validate } from "infra/errors";
import { signUpPatient } from "infra/queue/app";

export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req, reply) => {
    const { db, patient } = patientOf(req);
    // O corpo é conferido antes: um pedido inválido não gasta o token (que vale uma vez) na Cloudflare.
    const input = validate(signUpInputSchema, req.body);
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
    const r = await signUpPatient(db, patient, pathId(req, "sessionId"), input, Date.now());
    return reply.code(201).send(validate(signUpSchema, r));
  });
}
