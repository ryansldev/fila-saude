import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = path.resolve(__dirname, "..");
const KIT = "components/ui/";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const fontes = () =>
  [...arquivos(path.join(RAIZ, "app")), ...arquivos(path.join(RAIZ, "components"))].map((p) => ({
    rel: path.relative(RAIZ, p),
    linhas: readFileSync(p, "utf8").split("\n"),
  }));

describe("design system do painel", () => {
  it("nenhum <button> fora de components/ui/: use Button, BotaoDeEscolha, Segmentado…", () => {
    const fora = fontes()
      .filter((f) => !f.rel.startsWith(KIT))
      .flatMap((f) => f.linhas.flatMap((l, i) => (/<button\b/.test(l) ? [`${f.rel}:${i + 1}`] : [])));
    expect(fora).toEqual([]);
  });

  it("botões só com os nomes do design system (variante, tamanho), nunca variant/size", () => {
    // Fora do kit, nenhum componente usa variant/size: qualquer atributo assim é um botão no formato antigo.
    const antigos = fontes()
      .filter((f) => !f.rel.startsWith(KIT))
      .flatMap((f) => f.linhas.flatMap((l, i) => (/\s(variant|size)=/.test(l) ? [`${f.rel}:${i + 1}`] : [])));
    expect(antigos).toEqual([]);
  });
});
