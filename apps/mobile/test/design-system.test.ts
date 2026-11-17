import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../src");
const KIT = "components/ui.tsx";
/** Exceções, com o motivo: só o que não é botão. */
const EXCEPTIONS: Record<string, string> = {};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const rowsWith = (re: RegExp, allowed: string[]) =>
  files(SRC).flatMap((p) => {
    const rel = path.relative(SRC, p);
    if (allowed.includes(rel)) return [];
    return readFileSync(p, "utf8")
      .split("\n")
      .flatMap((l, i) => (re.test(l) ? [`${rel}:${i + 1}`] : []));
  });

describe("design system do app", () => {
  it("nenhum toque fora do kit (components/ui.tsx): use Botao, LinhaTocavel, ItemDeLista, AreaTocavel…", () => {
    expect(rowsWith(/<Pressable\b|TouchableOpacity|TouchableHighlight/, [KIT, ...Object.keys(EXCEPTIONS)])).toEqual([]);
  });

  it("LinkBotao não existe mais: é Botao variante texto ou textoPerigo", () => {
    expect(rowsWith(/\bLinkBotao\b/, [])).toEqual([]);
  });
});
