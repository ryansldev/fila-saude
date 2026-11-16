import { describe, expect, it } from "vitest";
import { estiloDoBotao, VARIANTES } from "../index.ts";

describe("estiloDoBotao (design system)", () => {
  it("app, principal, padrão: azul da ação, 56 px, canto 16, relevo 5 que afunda para 2 e desce 3", () => {
    expect(estiloDoBotao("app", "principal", "padrao")).toMatchObject({
      fundo: "#1a73c8",
      sombra: "#145a9b",
      texto: "#ffffff",
      altura: 56,
      raio: 16,
      relevo: 5,
      relevoTocado: 2,
      desce: 3,
    });
  });

  it("app, secundário, médio: fundo branco, borda clara, texto azul, 44 px, canto 14, relevo 4", () => {
    expect(estiloDoBotao("app", "secundario", "medio")).toMatchObject({
      fundo: "#ffffff",
      borda: "#e1e8ea",
      texto: "#1a73c8",
      altura: 44,
      raio: 14,
      relevo: 4,
    });
  });

  it("painel: padrão 40 px com relevo leve (3 → 2, desce 1); compacto 32 px; ícone sem relevo", () => {
    expect(estiloDoBotao("painel", "principal", "padrao")).toMatchObject({
      altura: 40,
      raio: 10,
      relevo: 3,
      relevoTocado: 2,
      desce: 1,
      fonteTamanho: 15,
    });
    expect(estiloDoBotao("painel", "principal", "compacto")).toMatchObject({ altura: 32, raio: 8, fonteTamanho: 13 });
    expect(estiloDoBotao("painel", "texto", "icone")).toMatchObject({ altura: 32, relevo: 0 });
  });

  it("texto e textoPerigo: sem fundo e sem relevo, nas duas plataformas; textoPerigo em vermelho", () => {
    for (const v of ["texto", "textoPerigo"] as const) {
      expect(estiloDoBotao("app", v, "padrao")).toMatchObject({ relevo: 0, fundo: "transparent" });
      expect(estiloDoBotao("painel", v, "padrao")).toMatchObject({ relevo: 0, fundo: "transparent" });
    }
    expect(estiloDoBotao("app", "textoPerigo", "padrao").texto).toBe("#993029");
  });

  it("perigo é cheio (só emergência); perigoContorno é branco com texto vermelho", () => {
    expect(estiloDoBotao("app", "perigo", "padrao")).toMatchObject({
      fundo: "#993029",
      sombra: "#6e1f1a",
      texto: "#ffffff",
    });
    expect(estiloDoBotao("painel", "perigoContorno", "padrao")).toMatchObject({ fundo: "#ffffff", texto: "#993029" });
  });

  it("no app, todo botão tem pelo menos 44 px (alvo de toque)", () => {
    for (const v of VARIANTES) {
      for (const t of ["padrao", "medio"] as const)
        expect(estiloDoBotao("app", v, t).altura).toBeGreaterThanOrEqual(44);
    }
  });
});
