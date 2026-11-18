import type { FastifyInstance } from "fastify";
import { captchaPage } from "infra/captcha";
import env from "infra/env";

// AD-062: página do Turnstile que o app nativo abre numa WebView. A chave do site é pública.
export default async function (app: FastifyInstance) {
  app.get("/", async (_req, reply) =>
    reply
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(captchaPage(env.TURNSTILE_SITE_KEY)),
  );
}
