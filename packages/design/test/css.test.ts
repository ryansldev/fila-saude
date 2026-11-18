import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateCss } from "../index.ts";

const without = (s: string) => s.replace(/\s+/g, "");

describe("tokens.css do painel", () => {
  it("as classes do botão saem dos mesmos tokens", () => {
    const css = without(generateCss());
    expect(css).toMatch(/\.ds-btn-primary\{[^}]*background:#1a73c8/);
    expect(css).toMatch(/\.ds-btn-compact\{[^}]*min-height:32px/);
    expect(css).toMatch(/\.ds-btn-default:active:not\(:disabled\)\{[^}]*translateY\(1px\)/);
    expect(css).toContain("--ds-action:#1a73c8");
  });

  it("as classes ficam na camada components do Tailwind: utilitários de layout (px-12, text-4xl) continuam valendo", () => {
    const css = generateCss();
    const layer = css.indexOf("@layer components {");
    expect(layer).toBeGreaterThan(-1);
    expect(css.indexOf(".ds-btn {")).toBeGreaterThan(layer);
    expect(css.indexOf(".ds-btn-default {")).toBeGreaterThan(layer);
  });

  it("o tokens.css versionado está em dia (senão: npm run design:gen)", () => {
    const file = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
    expect(file, "rode npm run design:gen").toBe(generateCss());
  });
});
