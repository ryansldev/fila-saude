import { describe, expect, it } from "vitest";
import { CAPTCHA_HEADER, TURNSTILE_TEST_SITE_KEY, turnstileSiteKey } from "../captcha";

describe("AD-062: chave do site do Turnstile nos clientes", () => {
  it("usa a chave configurada", () => {
    expect(turnstileSiteKey("0x4AAAreal", true)).toBe("0x4AAAreal");
  });

  it("sem chave, fora de produção, usa a de teste (sempre passa)", () => {
    expect(turnstileSiteKey(undefined, false)).toBe(TURNSTILE_TEST_SITE_KEY);
    expect(turnstileSiteKey("", false)).toBe(TURNSTILE_TEST_SITE_KEY);
  });

  it("sem chave em produção, não há widget (a de teste daria um token que a API recusa)", () => {
    expect(turnstileSiteKey(undefined, true)).toBeNull();
  });

  it("o cabeçalho do token é o mesmo para a API, o painel e o app", () => {
    expect(CAPTCHA_HEADER).toBe("x-captcha-token");
  });
});
