import { COLOR } from "@fila-saude/design";
import { describe, expect, it } from "vitest";
import { MAP_STYLE, nativeMap, pinAppearance } from "@/lib/map";

type Rule = (typeof MAP_STYLE)[number];
const rules = (featureType: string, elementType?: string) =>
  MAP_STYLE.filter((r: Rule) => r.featureType === featureType && (!elementType || r.elementType === elementType));
const value = (r: Rule[], key: string) =>
  r.flatMap((x) => x.stylers as Record<string, string>[]).find((s) => key in s)?.[key];

describe("o estilo do mapa (azul suave)", () => {
  it("esconde comércios e pontos de interesse, ônibus e as linhas de transporte", () => {
    expect(value(rules("poi"), "visibility")).toBe("off");
    expect(value(rules("transit.station.bus"), "visibility")).toBe("off");
    expect(value(rules("transit.line"), "visibility")).toBe("off");
  });

  it("mantém as estações de metrô e trem para a pessoa se localizar", () => {
    expect(value(rules("transit.station.rail"), "visibility")).toBe("on");
  });

  it("usa as cores do desenho: terra, água, ruas e avenidas", () => {
    expect(value(rules("landscape", "geometry"), "color")).toBe("#f5f8f9");
    expect(value(rules("water", "geometry"), "color")).toBe("#c9e2f3");
    expect(value(rules("road.local", "geometry.fill"), "color")).toBe("#ffffff");
    expect(value(rules("road.arterial", "geometry.fill"), "color")).toBe("#dcecf8");
    expect(value(rules("road.highway", "geometry.stroke"), "color")).toBe("#bcd8ef");
  });
});

describe("o pino da unidade", () => {
  it("verde com atendimento aberto, azul sem", () => {
    expect(pinAppearance(true, false)).toEqual({
      color: COLOR.green,
      relief: COLOR.greenShadow,
      size: 34,
      name: false,
    });
    expect(pinAppearance(false, false)).toEqual({
      color: COLOR.action,
      relief: COLOR.actionShadow,
      size: 34,
      name: false,
    });
  });

  it("a escolhida cresce e mostra o nome", () => {
    expect(pinAppearance(true, true)).toMatchObject({ size: 42, name: true, color: COLOR.green });
    expect(pinAppearance(false, true)).toMatchObject({ size: 42, name: true, color: COLOR.action });
  });
});

describe("mapa de verdade ou nenhum", () => {
  it("iPhone: Apple Maps, sem chave", () => {
    expect(nativeMap({ os: "ios", expoGo: false, mapsKey: undefined })).toBe(true);
  });

  it("Android no Expo Go: a chave é a do Expo Go", () => {
    expect(nativeMap({ os: "android", expoGo: true, mapsKey: undefined })).toBe(true);
  });

  it("Android no build próprio: Google Maps só com a chave; sem ela, sem mapa (só a lista), sem travar o app", () => {
    expect(nativeMap({ os: "android", expoGo: false, mapsKey: "AIza-chave" })).toBe(true);
    expect(nativeMap({ os: "android", expoGo: false, mapsKey: undefined })).toBe(false);
    expect(nativeMap({ os: "android", expoGo: false, mapsKey: "" })).toBe(false);
  });
});
