import { describe, expect, it } from "vitest";
import { noticeScreen } from "@/lib/notices";

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
