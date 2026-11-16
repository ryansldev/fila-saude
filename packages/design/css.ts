import { estiloDoBotao, type TamanhoPainel, VARIANTES } from "./botao.ts";
import { COR, OPACIDADE_DESATIVADO } from "./tokens.ts";

const TAMANHOS: TamanhoPainel[] = ["padrao", "compacto", "icone"];

/**
 * O CSS do painel, gerado dos mesmos tokens do app: variáveis de cor e as classes `.ds-btn-*`.
 * Não editar `tokens.css` à mão: `npm run design:gen`.
 */
export function gerarCss(): string {
  const l: string[] = [
    "/* Gerado por packages/design (npm run design:gen). Não edite à mão. */",
    ":root {",
    `  --ds-acao: ${COR.action};`,
    `  --ds-acao-pressionado: ${COR.actionPressed};`,
    `  --ds-acao-sombra: ${COR.acaoSombra};`,
    `  --ds-linha: ${COR.linha};`,
    `  --ds-perigo: ${COR.dangerInk};`,
    `  --ds-sucesso: ${COR.verde};`,
    "}",
    ".ds-btn {",
    "  display: inline-flex; align-items: center; justify-content: center; gap: 6px;",
    "  font-family: var(--font-nunito), Nunito, system-ui, sans-serif; white-space: nowrap;",
    "  border-style: solid; border-width: 2px; cursor: pointer; user-select: none;",
    "  transition: transform 60ms, border-bottom-width 60ms, background-color 120ms;",
    "}",
    ".ds-btn:focus-visible { outline: 3px solid var(--ds-acao); outline-offset: 2px; }",
    ".ds-btn > span { overflow: hidden; text-overflow: ellipsis; }",
  ];
  for (const v of VARIANTES) {
    const e = estiloDoBotao("painel", v, "padrao");
    l.push(
      `.ds-btn-${v} { background: ${e.fundo}; border-color: ${e.borda}; border-bottom-color: ${e.sombra}; color: ${e.texto}; font-weight: ${e.fontePeso}; }`,
    );
    if (e.relevo === 0) l.push(`.ds-btn-${v} { border-bottom-width: 2px !important; transform: none !important; }`);
    if (v === "texto" || v === "textoPerigo")
      l.push(`.ds-btn-${v} { text-decoration: underline; text-underline-offset: 3px; }`);
  }
  for (const t of TAMANHOS) {
    const e = estiloDoBotao("painel", "principal", t);
    const largura = t === "icone" ? ` width: ${e.altura}px;` : "";
    l.push(
      `.ds-btn-${t} { min-height: ${e.altura}px; border-radius: ${e.raio}px; font-size: ${e.fonteTamanho}px; padding: 0 ${e.paddingX}px; border-bottom-width: ${Math.max(e.relevo, 2)}px;${largura} }`,
      `.ds-btn-${t}:active:not(:disabled) { border-bottom-width: ${Math.max(e.relevoTocado, 2)}px; transform: translateY(${e.desce}px); }`,
    );
  }
  l.push(
    `.ds-btn:disabled { opacity: ${OPACIDADE_DESATIVADO}; cursor: not-allowed; border-bottom-width: 2px; transform: none; }`,
  );
  return `${l.join("\n")}\n`;
}
