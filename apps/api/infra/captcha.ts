import env from "infra/env";

export { CAPTCHA_HEADER } from "@fila-saude/schemas/captcha";

// PD-19: com NODE_ENV=test, a API aceita este token sem ir à Cloudflare (fora dos testes, nunca).
const TEST_TOKEN = "teste-captcha-ok";

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * O resultado do captcha: `missing` (sem token), `ok`, `rejected` (a Cloudflare recusou o token) ou
 * `unavailable` (a Cloudflare não respondeu). Os dois últimos não deixam passar (falha fechada), mas só
 * `rejected` é culpa de quem mandou.
 */
export type CaptchaResult = "missing" | "ok" | "rejected" | "unavailable";

/** Confere o token na Cloudflare. */
export async function turnstileVerify(
  secret: string,
  token: string,
  ip: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<Exclude<CaptchaResult, "missing">> {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const r = await fetcher(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(5_000) });
    const answer = (await r.json()) as { success?: unknown; "error-codes"?: unknown };
    if (answer.success === true) return "ok";
    if (answer.success !== false) return "unavailable";
    // `internal-error` é da Cloudflare, não do token: não conta como erro de quem mandou.
    const codes = Array.isArray(answer["error-codes"]) ? answer["error-codes"] : [];
    return codes.includes("internal-error") ? "unavailable" : "rejected";
  } catch {
    return "unavailable";
  }
}

/** AD-062: o captcha do pedido (cabeçalho `x-captcha-token`, vazio = sem token). Cada token vale uma vez só. */
export function checkCaptcha(token: string | null | undefined, ip: string | undefined): Promise<CaptchaResult> {
  if (!token) return Promise.resolve("missing");
  if (env.NODE_ENV === "test") return Promise.resolve(token === TEST_TOKEN ? "ok" : "rejected");
  return turnstileVerify(env.TURNSTILE_SECRET_KEY, token, ip);
}

/**
 * AD-062: página do widget para a WebView do app nativo (o Turnstile não tem SDK nativo; a Cloudflare
 * orienta carregar uma página nossa). O token vai ao app por `ReactNativeWebView.postMessage`; se o
 * desafio falhar, vai `{ type: "error" }` e o app orienta a procurar a recepção. Token vencido o próprio
 * Turnstile renova (e manda o novo pelo `callback`).
 */
export function captchaPage(siteKey: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confirmação</title>
<style>html,body{margin:0;padding:0;background:#fff}body{display:flex;justify-content:center;padding-top:4px}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=start&render=explicit" async defer></script>
</head>
<body>
<div id="captcha"></div>
<script>
function send(message) {
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(message));
}
function start() {
  turnstile.render("#captcha", {
    sitekey: ${JSON.stringify(siteKey)},
    language: "pt-br",
    callback: function (token) { send({ type: "token", token: token }); },
    "error-callback": function () { send({ type: "error" }); }
  });
}
</script>
</body>
</html>`;
}
