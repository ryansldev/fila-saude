import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gerarCss } from "../index.ts";

const sem = (s: string) => s.replace(/\s+/g, "");

describe("tokens.css do painel", () => {
  it("as classes do botão saem dos mesmos tokens", () => {
    const css = sem(gerarCss());
    expect(css).toMatch(/\.ds-btn-principal\{[^}]*background:#1a73c8/);
    expect(css).toMatch(/\.ds-btn-compacto\{[^}]*min-height:32px/);
    expect(css).toMatch(/\.ds-btn-padrao:active:not\(:disabled\)\{[^}]*translateY\(1px\)/);
    expect(css).toContain("--ds-acao:#1a73c8");
  });

  it("as classes ficam na camada components do Tailwind: utilitários de layout (px-12, text-4xl) continuam valendo", () => {
    const css = gerarCss();
    const camada = css.indexOf("@layer components {");
    expect(camada).toBeGreaterThan(-1);
    expect(css.indexOf(".ds-btn {")).toBeGreaterThan(camada);
    expect(css.indexOf(".ds-btn-padrao {")).toBeGreaterThan(camada);
  });

  it("o tokens.css versionado está em dia (senão: npm run design:gen)", () => {
    const arquivo = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
    expect(arquivo, "rode npm run design:gen").toBe(gerarCss());
  });
});
