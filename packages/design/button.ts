import { COLOR } from "./tokens.ts";

export type Variant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "outlineDanger"
  | "text"
  | "dangerText"
  | "white";
export const VARIANTS: readonly Variant[] = [
  "primary",
  "secondary",
  "success",
  "danger",
  "outlineDanger",
  "text",
  "dangerText",
  "white",
];

export type AppSize = "default" | "medium";
export type PanelSize = "default" | "compact" | "icon";

export type ButtonStyle = {
  background: string;
  border: string;
  shadow: string;
  text: string;
  height: number;
  radius: number;
  fontSize: number;
  fontWeight: 700 | 800;
  relief: number;
  pressedRelief: number;
  pressDepth: number;
  paddingX: number;
};

type Colors = Pick<ButtonStyle, "background" | "border" | "shadow" | "text">;

/** As cores de cada variação: iguais no app e no painel. */
const COLORS: Record<Variant, Colors> = {
  primary: { background: COLOR.action, border: COLOR.action, shadow: COLOR.actionShadow, text: "#ffffff" },
  secondary: { background: COLOR.surface, border: COLOR.line, shadow: COLOR.line, text: COLOR.action },
  success: { background: COLOR.green, border: COLOR.green, shadow: COLOR.greenShadow, text: "#ffffff" },
  danger: { background: COLOR.dangerInk, border: COLOR.dangerInk, shadow: COLOR.dangerShadow, text: "#ffffff" },
  outlineDanger: { background: COLOR.surface, border: COLOR.line, shadow: COLOR.line, text: COLOR.dangerInk },
  text: { background: "transparent", border: "transparent", shadow: "transparent", text: COLOR.actionPressed },
  dangerText: { background: "transparent", border: "transparent", shadow: "transparent", text: COLOR.dangerInk },
  white: { background: "#ffffff", border: "#ffffff", shadow: COLOR.whiteShadow, text: COLOR.primary900 },
};

type Density = Omit<ButtonStyle, keyof Colors | "fontWeight">;

/** App (Duolingo): relevo grande. Painel (portal do iFood): o mesmo botão, com relevo leve. */
const DENSITIES = {
  app: {
    default: { height: 56, radius: 16, fontSize: 18, relief: 5, pressedRelief: 2, pressDepth: 3, paddingX: 22 },
    medium: { height: 44, radius: 14, fontSize: 16, relief: 4, pressedRelief: 2, pressDepth: 2, paddingX: 16 },
  },
  panel: {
    default: { height: 40, radius: 10, fontSize: 15, relief: 3, pressedRelief: 2, pressDepth: 1, paddingX: 16 },
    compact: { height: 32, radius: 8, fontSize: 13, relief: 3, pressedRelief: 2, pressDepth: 1, paddingX: 12 },
    icon: { height: 32, radius: 8, fontSize: 13, relief: 0, pressedRelief: 0, pressDepth: 0, paddingX: 0 },
  },
} satisfies { app: Record<AppSize, Density>; panel: Record<PanelSize, Density> };

const NO_RELIEF: Variant[] = ["text", "dangerText"];

/** O estilo de um botão do design system: cores da variação + medidas da densidade da plataforma. */
export function buttonStyle(platform: "app", variant: Variant, size: AppSize): ButtonStyle;
export function buttonStyle(platform: "panel", variant: Variant, size: PanelSize): ButtonStyle;
export function buttonStyle(platform: "app" | "panel", variant: Variant, size: AppSize | PanelSize): ButtonStyle {
  const d: Density = (DENSITIES[platform] as Record<string, Density>)[size] as Density;
  const plan = NO_RELIEF.includes(variant);
  return {
    ...COLORS[variant],
    ...d,
    fontWeight: plan ? 700 : 800,
    ...(plan ? { relief: 0, pressedRelief: 0, pressDepth: 0 } : {}),
  };
}
