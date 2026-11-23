import { describe, expect, it } from "vitest";
import { explainNoticesFirst, noticeScreen } from "@/lib/notices";

describe("a tela dos avisos (aberta pelo sininho)", () => {
  it("ligados: só confirma, sem botão de ligar", () => {
    expect(noticeScreen({ kind: "on" })).toMatchObject({ title: "seus avisos estão ligados", button: null });
  });

  it("nunca perguntados ou negados uma vez: explica e pede pelo celular", () => {
    for (const state of [{ kind: "ask" }, { kind: "off", canRequest: true }] as const) {
      expect(noticeScreen(state)).toMatchObject({
        title: "a gente te avisa a hora de sair de casa",
        button: "ligar os avisos",
        hint: "na próxima tela, toque em “permitir”.",
      });
    }
  });

  it("negados de vez: só os ajustes do celular resolvem", () => {
    expect(noticeScreen({ kind: "off", canRequest: false })).toMatchObject({
      title: "seus avisos estão desligados",
      button: "ligar nos ajustes",
    });
  });
});

describe("a explicação dos avisos logo depois de entrar", () => {
  it("nunca perguntados (iPhone): explica antes do pedido", () => {
    expect(explainNoticesFirst({ kind: "ask" }, false)).toBe(true);
  });

  it("Android 13+: nunca perguntados chegam como negados que ainda podem pedir; explica também", () => {
    expect(explainNoticesFirst({ kind: "off", canRequest: true }, false)).toBe(true);
  });

  it("já explicada uma vez: não volta a cada entrada", () => {
    expect(explainNoticesFirst({ kind: "ask" }, true)).toBe(false);
    expect(explainNoticesFirst({ kind: "off", canRequest: true }, true)).toBe(false);
  });

  it("ligados, ou só os ajustes resolvem: segue direto (o sininho mostra o caminho)", () => {
    expect(explainNoticesFirst({ kind: "on" }, false)).toBe(false);
    expect(explainNoticesFirst({ kind: "off", canRequest: false }, false)).toBe(false);
  });
});
