import { describe, expect, it } from "vitest";
import { buttonStyle, VARIANTS } from "../index.ts";

describe("estiloDoBotao (design system)", () => {
  it("app, principal, padrão: azul da ação, 56 px, canto 16, relevo 5 que afunda para 2 e desce 3", () => {
    expect(buttonStyle("app", "primary", "default")).toMatchObject({
      background: "#1a73c8",
      shadow: "#145a9b",
      text: "#ffffff",
      height: 56,
      radius: 16,
      relief: 5,
      pressedRelief: 2,
      pressDepth: 3,
    });
  });

  it("app, secundário, médio: fundo branco, borda clara, texto azul, 44 px, canto 14, relevo 4", () => {
    expect(buttonStyle("app", "secondary", "medium")).toMatchObject({
      background: "#ffffff",
      border: "#e1e8ea",
      text: "#1a73c8",
      height: 44,
      radius: 14,
      relief: 4,
    });
  });

  it("painel: padrão 40 px com relevo leve (3 → 2, desce 1); compacto 32 px; ícone sem relevo", () => {
    expect(buttonStyle("panel", "primary", "default")).toMatchObject({
      height: 40,
      radius: 10,
      relief: 3,
      pressedRelief: 2,
      pressDepth: 1,
      fontSize: 15,
    });
    expect(buttonStyle("panel", "primary", "compact")).toMatchObject({ height: 32, radius: 8, fontSize: 13 });
    expect(buttonStyle("panel", "text", "icon")).toMatchObject({ height: 32, relief: 0 });
  });

  it("texto e textoPerigo: sem fundo e sem relevo, nas duas plataformas; textoPerigo em vermelho", () => {
    for (const v of ["text", "dangerText"] as const) {
      expect(buttonStyle("app", v, "default")).toMatchObject({ relief: 0, background: "transparent" });
      expect(buttonStyle("panel", v, "default")).toMatchObject({ relief: 0, background: "transparent" });
    }
    expect(buttonStyle("app", "dangerText", "default").text).toBe("#993029");
  });

  it("perigo é cheio (só emergência); perigoContorno é branco com texto vermelho", () => {
    expect(buttonStyle("app", "danger", "default")).toMatchObject({
      background: "#993029",
      shadow: "#6e1f1a",
      text: "#ffffff",
    });
    expect(buttonStyle("panel", "outlineDanger", "default")).toMatchObject({ background: "#ffffff", text: "#993029" });
  });

  it("no app, todo botão tem pelo menos 44 px (alvo de toque)", () => {
    for (const v of VARIANTS) {
      for (const t of ["default", "medium"] as const)
        expect(buttonStyle("app", v, t).height).toBeGreaterThanOrEqual(44);
    }
  });
});
