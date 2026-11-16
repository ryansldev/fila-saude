import { describe, expect, it } from "vitest";
import { telaDosAvisos } from "@/lib/avisos";

describe("a tela dos avisos (aberta pelo sininho)", () => {
  it("ligados: só confirma, sem botão de ligar", () => {
    expect(telaDosAvisos({ tipo: "ligados" })).toMatchObject({ titulo: "seus avisos estão ligados", botao: null });
  });

  it("nunca perguntados ou negados uma vez: explica e pede pelo celular", () => {
    for (const estado of [{ tipo: "perguntar" }, { tipo: "desligados", podePedir: true }] as const) {
      expect(telaDosAvisos(estado)).toMatchObject({
        titulo: "a gente te avisa a hora de sair de casa",
        botao: "ligar os avisos",
        dica: "na próxima tela, toque em “permitir”.",
      });
    }
  });

  it("negados de vez: só os ajustes do celular resolvem", () => {
    expect(telaDosAvisos({ tipo: "desligados", podePedir: false })).toMatchObject({
      titulo: "seus avisos estão desligados",
      botao: "ligar nos ajustes",
    });
  });
});
