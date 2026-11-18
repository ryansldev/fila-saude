import { describe, expect, it } from "vitest";
import { captchaMessage, needsCaptcha } from "@/lib/captcha";

describe("AD-062: mensagens da página do captcha (WebView)", () => {
  it("token e erro viram eventos; o resto é ignorado (token vencido, o Turnstile renova sozinho)", () => {
    expect(captchaMessage('{"type":"token","token":"abc"}')).toEqual({ kind: "token", token: "abc" });
    expect(captchaMessage('{"type":"error"}')).toEqual({ kind: "error" });
    expect(captchaMessage('{"type":"expired"}')).toBeNull();
    expect(captchaMessage('{"type":"token"}')).toBeNull();
    expect(captchaMessage("não é json")).toBeNull();
    expect(captchaMessage('"texto"')).toBeNull();
  });

  it("só a inscrição em sessão pede captcha (lista de espera e refazer, não)", () => {
    expect(needsCaptcha("session")).toBe(true);
    expect(needsCaptcha("list")).toBe(false);
    expect(needsCaptcha("redo")).toBe(false);
  });
});
