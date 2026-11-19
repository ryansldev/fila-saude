import type { FastifyInstance } from "fastify";
import { captchaPage } from "infra/captcha";
import env from "infra/env";
import { TAGS } from "infra/openapi/schemas";
import z from "zod";

// AD-062: página do Turnstile que o app nativo abre numa WebView. A chave do site é pública.
export default async function (app: FastifyInstance) {
  const schema = {
    tags: [TAGS.system],
    summary: "Página do captcha para o app",
    response: { 200: { description: "Página HTML do Turnstile", content: { "text/html": { schema: z.string() } } } },
  };
  app.get("/", { schema }, async (_req, reply) =>
    reply
      .type("text/html; charset=utf-8")
      .header("cache-control", "no-store")
      .send(captchaPage(env.TURNSTILE_SITE_KEY)),
  );
}
