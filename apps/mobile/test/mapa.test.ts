import { COR } from "@fila-saude/design";
import { describe, expect, it } from "vitest";
import { aparenciaDoPino, ESTILO_DO_MAPA } from "@/lib/mapa";

type Regra = (typeof ESTILO_DO_MAPA)[number];
const regras = (featureType: string, elementType?: string) =>
  ESTILO_DO_MAPA.filter((r: Regra) => r.featureType === featureType && (!elementType || r.elementType === elementType));
const valor = (r: Regra[], chave: string) =>
  r.flatMap((x) => x.stylers as Record<string, string>[]).find((s) => chave in s)?.[chave];

describe("o estilo do mapa (azul suave)", () => {
  it("esconde comércios e pontos de interesse, ônibus e as linhas de transporte", () => {
    expect(valor(regras("poi"), "visibility")).toBe("off");
    expect(valor(regras("transit.station.bus"), "visibility")).toBe("off");
    expect(valor(regras("transit.line"), "visibility")).toBe("off");
  });

  it("mantém as estações de metrô e trem para a pessoa se localizar", () => {
    expect(valor(regras("transit.station.rail"), "visibility")).toBe("on");
  });

  it("usa as cores do desenho: terra, água, ruas e avenidas", () => {
    expect(valor(regras("landscape", "geometry"), "color")).toBe("#f5f8f9");
    expect(valor(regras("water", "geometry"), "color")).toBe("#c9e2f3");
    expect(valor(regras("road.local", "geometry.fill"), "color")).toBe("#ffffff");
    expect(valor(regras("road.arterial", "geometry.fill"), "color")).toBe("#dcecf8");
    expect(valor(regras("road.highway", "geometry.stroke"), "color")).toBe("#bcd8ef");
  });
});

describe("o pino da unidade", () => {
  it("verde com atendimento aberto, azul sem", () => {
    expect(aparenciaDoPino(true, false)).toEqual({ cor: COR.verde, relevo: COR.verdeSombra, tamanho: 34, nome: false });
    expect(aparenciaDoPino(false, false)).toEqual({
      cor: COR.action,
      relevo: COR.acaoSombra,
      tamanho: 34,
      nome: false,
    });
  });

  it("a escolhida cresce e mostra o nome", () => {
    expect(aparenciaDoPino(true, true)).toMatchObject({ tamanho: 42, nome: true, cor: COR.verde });
    expect(aparenciaDoPino(false, true)).toMatchObject({ tamanho: 42, nome: true, cor: COR.action });
  });
});
