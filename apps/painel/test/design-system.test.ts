import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const KIT = "components/ui/";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (n === "node_modules" || n.startsWith(".")) return [];
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const fonts = () =>
  [...files(path.join(ROOT, "app")), ...files(path.join(ROOT, "components"))].map((p) => ({
    rel: path.relative(ROOT, p),
    rows: readFileSync(p, "utf8").split("\n"),
  }));

describe("design system do painel", () => {
  it("nenhum <button> fora de components/ui/: use Button, BotaoDeEscolha, Segmentado…", () => {
    const outside = fonts()
      .filter((f) => !f.rel.startsWith(KIT))
      .flatMap((f) => f.rows.flatMap((l, i) => (/<button\b/.test(l) ? [`${f.rel}:${i + 1}`] : [])));
    expect(outside).toEqual([]);
  });

  it("botões só com as variantes e os tamanhos do design system (nunca os do shadcn)", () => {
    // Fora do kit, variant/size só com os valores do design system: outro valor é um botão no formato antigo.
    const DS =
      /\s(variant|size)="(primary|secondary|success|danger|outlineDanger|text|dangerText|white|default|compact|icon)"/g;
    const old = fonts()
      .filter((f) => !f.rel.startsWith(KIT))
      .flatMap((f) =>
        f.rows.flatMap((l, i) => (/\s(variant|size)="/.test(l.replace(DS, "")) ? [`${f.rel}:${i + 1}`] : [])),
      );
    expect(old).toEqual([]);
  });
});
