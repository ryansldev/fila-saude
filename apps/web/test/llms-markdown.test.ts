import { describe, expect, it } from "vitest";
import { asMarkdown } from "@/lib/llms-markdown";

// O Markdown dos guias para ferramentas de IA: os componentes de layout em Markdown puro.
describe("asMarkdown", () => {
  it("tira o herói", () => {
    expect(asMarkdown('antes\n\n<Hero title="a" lead="b" />\n\ndepois')).toBe("antes\n\ndepois");
  });

  it("o fluxo vira uma lista numerada, com aspas duplas, simples e vírgula no fim", () => {
    expect(asMarkdown('<Flow steps={["se inscreve", "espera"]} />')).toBe("1. se inscreve\n2. espera");
    expect(asMarkdown("<Flow steps={['a', 'b',]} />")).toBe("1. a\n2. b");
    expect(asMarkdown('<Flow steps={["diga \\"oi\\""]} />')).toBe('1. diga "oi"');
    expect(asMarkdown('<Flow steps={[`linha 1\nlinha 2`, "b"]} />')).toBe("1. linha 1\nlinha 2\n2. b");
  });
});
