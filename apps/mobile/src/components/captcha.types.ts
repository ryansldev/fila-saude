/** AD-062: o widget do Turnstile entrega o token (que vale uma vez) ou avisa que não deu. */
export type CaptchaProps = { onToken: (token: string) => void; onError: () => void };

/** Altura do widget da Cloudflare (o modo "normal" tem 65 px), com folga. */
export const CAPTCHA_HEIGHT = 80;
