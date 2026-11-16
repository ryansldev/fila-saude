import { COR } from "./tokens.ts";

export type Variante =
  | "principal"
  | "secundario"
  | "sucesso"
  | "perigo"
  | "perigoContorno"
  | "texto"
  | "textoPerigo"
  | "branco";
export const VARIANTES: readonly Variante[] = [
  "principal",
  "secundario",
  "sucesso",
  "perigo",
  "perigoContorno",
  "texto",
  "textoPerigo",
  "branco",
];

export type TamanhoApp = "padrao" | "medio";
export type TamanhoPainel = "padrao" | "compacto" | "icone";

export type EstiloDoBotao = {
  fundo: string;
  borda: string;
  sombra: string;
  texto: string;
  altura: number;
  raio: number;
  fonteTamanho: number;
  fontePeso: 700 | 800;
  relevo: number;
  relevoTocado: number;
  desce: number;
  paddingX: number;
};

type Cores = Pick<EstiloDoBotao, "fundo" | "borda" | "sombra" | "texto">;

/** As cores de cada variação: iguais no app e no painel. */
const CORES: Record<Variante, Cores> = {
  principal: { fundo: COR.action, borda: COR.action, sombra: COR.acaoSombra, texto: "#ffffff" },
  secundario: { fundo: COR.surface, borda: COR.linha, sombra: COR.linha, texto: COR.action },
  sucesso: { fundo: COR.verde, borda: COR.verde, sombra: COR.verdeSombra, texto: "#ffffff" },
  perigo: { fundo: COR.dangerInk, borda: COR.dangerInk, sombra: COR.perigoSombra, texto: "#ffffff" },
  perigoContorno: { fundo: COR.surface, borda: COR.linha, sombra: COR.linha, texto: COR.dangerInk },
  texto: { fundo: "transparent", borda: "transparent", sombra: "transparent", texto: COR.actionPressed },
  textoPerigo: { fundo: "transparent", borda: "transparent", sombra: "transparent", texto: COR.dangerInk },
  branco: { fundo: "#ffffff", borda: "#ffffff", sombra: COR.brancoSombra, texto: COR.primary900 },
};

type Densidade = Omit<EstiloDoBotao, keyof Cores | "fontePeso">;

/** App (Duolingo): relevo grande. Painel (portal do iFood): o mesmo botão, com relevo leve. */
const DENSIDADES = {
  app: {
    padrao: { altura: 56, raio: 16, fonteTamanho: 18, relevo: 5, relevoTocado: 2, desce: 3, paddingX: 22 },
    medio: { altura: 44, raio: 14, fonteTamanho: 16, relevo: 4, relevoTocado: 2, desce: 2, paddingX: 16 },
  },
  painel: {
    padrao: { altura: 40, raio: 10, fonteTamanho: 15, relevo: 3, relevoTocado: 2, desce: 1, paddingX: 16 },
    compacto: { altura: 32, raio: 8, fonteTamanho: 13, relevo: 3, relevoTocado: 2, desce: 1, paddingX: 12 },
    icone: { altura: 32, raio: 8, fonteTamanho: 13, relevo: 0, relevoTocado: 0, desce: 0, paddingX: 0 },
  },
} satisfies { app: Record<TamanhoApp, Densidade>; painel: Record<TamanhoPainel, Densidade> };

const SEM_RELEVO: Variante[] = ["texto", "textoPerigo"];

/** O estilo de um botão do design system: cores da variação + medidas da densidade da plataforma. */
export function estiloDoBotao(plataforma: "app", variante: Variante, tamanho: TamanhoApp): EstiloDoBotao;
export function estiloDoBotao(plataforma: "painel", variante: Variante, tamanho: TamanhoPainel): EstiloDoBotao;
export function estiloDoBotao(
  plataforma: "app" | "painel",
  variante: Variante,
  tamanho: TamanhoApp | TamanhoPainel,
): EstiloDoBotao {
  const d: Densidade = (DENSIDADES[plataforma] as Record<string, Densidade>)[tamanho] as Densidade;
  const plano = SEM_RELEVO.includes(variante);
  return {
    ...CORES[variante],
    ...d,
    fontePeso: plano ? 700 : 800,
    ...(plano ? { relevo: 0, relevoTocado: 0, desce: 0 } : {}),
  };
}
