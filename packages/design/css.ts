import { buttonStyle, type PanelSize, VARIANTS } from "./button.ts";
import { COLOR, DISABLED_OPACITY } from "./tokens.ts";

const SIZES: PanelSize[] = ["default", "compact", "icon"];

/**
 * O CSS do painel, gerado dos mesmos tokens do app: variáveis de cor e as classes `.ds-btn-*`.
 * Não editar `tokens.css` à mão: `npm run design:gen`.
 */
export function generateCss(): string {
  const l: string[] = [
    "/* Gerado por packages/design (npm run design:gen). Não edite à mão. */",
    ":root {",
    `  --ds-action: ${COLOR.action};`,
    `  --ds-action-pressed: ${COLOR.actionPressed};`,
    `  --ds-action-shadow: ${COLOR.actionShadow};`,
    `  --ds-line: ${COLOR.line};`,
    `  --ds-danger: ${COLOR.dangerInk};`,
    `  --ds-success: ${COLOR.green};`,
    "}",
    // Na camada components do Tailwind: os utilitários de layout passados em className (largura,
    // margem, tamanho do botão da TV) vencem; CSS fora de camada venceria tudo.
    "@layer components {",
    ".ds-btn {",
    "  display: inline-flex; align-items: center; justify-content: center; gap: 6px;",
    "  font-family: var(--font-nunito), Nunito, system-ui, sans-serif; white-space: nowrap;",
    "  border-style: solid; border-width: 2px; cursor: pointer; user-select: none;",
    "  transition: transform 60ms, border-bottom-width 60ms, background-color 120ms;",
    "}",
    ".ds-btn:focus-visible { outline: 3px solid var(--ds-action); outline-offset: 2px; }",
    ".ds-btn > span { overflow: hidden; text-overflow: ellipsis; }",
  ];
  for (const v of VARIANTS) {
    const e = buttonStyle("panel", v, "default");
    l.push(
      `.ds-btn-${v} { background: ${e.background}; border-color: ${e.border}; border-bottom-color: ${e.shadow}; color: ${e.text}; font-weight: ${e.fontWeight}; }`,
    );
    if (e.relief === 0) l.push(`.ds-btn-${v} { border-bottom-width: 2px !important; transform: none !important; }`);
    if (v === "text" || v === "dangerText")
      l.push(`.ds-btn-${v} { text-decoration: underline; text-underline-offset: 3px; }`);
  }
  for (const t of SIZES) {
    const e = buttonStyle("panel", "primary", t);
    const width = t === "icon" ? ` width: ${e.height}px;` : "";
    l.push(
      `.ds-btn-${t} { min-height: ${e.height}px; border-radius: ${e.radius}px; font-size: ${e.fontSize}px; padding: 0 ${e.paddingX}px; border-bottom-width: ${Math.max(e.relief, 2)}px;${width} }`,
      `.ds-btn-${t}:active:not(:disabled) { border-bottom-width: ${Math.max(e.pressedRelief, 2)}px; transform: translateY(${e.pressDepth}px); }`,
    );
  }
  l.push(
    `.ds-btn:disabled { opacity: ${DISABLED_OPACITY}; cursor: not-allowed; border-bottom-width: 2px; transform: none; }`,
  );
  l.push("}");
  return `${l.join("\n")}\n`;
}
