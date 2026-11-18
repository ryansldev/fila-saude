import type { SignUpMode } from "./sign-ups";

export type CaptchaEvent = { kind: "token"; token: string } | { kind: "error" };

/** AD-062: o que a página do captcha (na WebView) mandou; o que não for dela é ignorado. */
export function captchaMessage(raw: string): CaptchaEvent | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const { type, token } = data as { type?: unknown; token?: unknown };
  if (type === "token" && typeof token === "string" && token) return { kind: "token", token };
  if (type === "error") return { kind: "error" };
  return null;
}

/** RN-ID-07: só a inscrição em sessão pública pede captcha; lista de espera e refazer, não. */
export const needsCaptcha = (mode: SignUpMode): boolean => mode === "session";
