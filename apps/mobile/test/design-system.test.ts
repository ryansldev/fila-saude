import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../src");
const KIT = "components/ui.tsx";
/** Exceções, com o motivo: só o que não é botão. */
const EXCECOES: Record<string, string> = {
  "components/mapa.tsx": "marcadores do mapa não são botões",
  "components/mapa.native.tsx": "marcadores do mapa não são botões",
};

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const linhasCom = (re: RegExp, permitidos: string[]) =>
  arquivos(SRC).flatMap((p) => {
    const rel = path.relative(SRC, p);
    if (permitidos.includes(rel)) return [];
    return readFileSync(p, "utf8")
      .split("\n")
      .flatMap((l, i) => (re.test(l) ? [`${rel}:${i + 1}`] : []));
  });

describe("design system do app", () => {
  it("nenhum toque fora do kit (components/ui.tsx): use Botao, LinhaTocavel, ItemDeLista, AreaTocavel…", () => {
    expect(linhasCom(/<Pressable\b|TouchableOpacity|TouchableHighlight/, [KIT, ...Object.keys(EXCECOES)])).toEqual([]);
  });

  it("LinkBotao não existe mais: é Botao variante texto ou textoPerigo", () => {
    expect(linhasCom(/\bLinkBotao\b/, [])).toEqual([]);
  });
});
