/** AD-062: cabeçalho em que o app e o painel mandam o token do Turnstile (login e inscrição). */
export const CAPTCHA_HEADER = "x-captcha-token";

/** Chave de site de teste da Cloudflare: o widget sempre passa (e o segredo de teste aceita o token). */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

/**
 * AD-062: chave do site para o widget. Sem chave configurada, a de teste fora de produção; em produção,
 * `null` (sem widget): a de teste daria um token que o segredo de verdade da API recusa.
 */
export function turnstileSiteKey(configured: string | undefined, production: boolean): string | null {
  if (configured) return configured;
  return production ? null : TURNSTILE_TEST_SITE_KEY;
}
