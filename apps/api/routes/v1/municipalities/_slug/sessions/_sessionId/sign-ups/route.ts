import { signUpInputSchema, signUpSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { patientOf } from "infra/auth/patient-session";
import { CAPTCHA_HEADER, verifyCaptcha } from "infra/captcha";
import { pathId } from "infra/config/common";
import { ApiError, validate } from "infra/errors";
import { signUpPatient } from "infra/queue/app";

export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant, app.requirePatient] }, async (req, reply) => {
    const { db, patient } = patientOf(req);
    // O corpo é conferido antes: um pedido inválido não gasta o token (que vale uma vez) na Cloudflare.
    const input = validate(signUpInputSchema, req.body);
    // RN-ID-07 / AD-062: só há inscrição pelo app em sessão pública, e ela pede o captcha.
    const token = req.headers[CAPTCHA_HEADER];
    if (!(await verifyCaptcha(typeof token === "string" ? token : null, req.ip))) {
      throw new ApiError(
        400,
        "captcha_required",
        undefined,
        "Não conseguimos confirmar que você não é um robô. Tente de novo ou procure a recepção.",
      );
    }
    const r = await signUpPatient(db, patient, pathId(req, "sessionId"), input, Date.now());
    return reply.code(201).send(validate(signUpSchema, r));
  });
}
