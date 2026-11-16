import { COR } from "@fila-saude/design";

/** Uma regra de estilo do Google Maps (o `customMapStyle` do react-native-maps). */
export type RegraDoMapa = { featureType?: string; elementType?: string; stylers: object[] };

const cor = (featureType: string, elementType: string, color: string): RegraDoMapa => ({
  featureType,
  elementType,
  stylers: [{ color }],
});
const esconder = (featureType: string, elementType?: string): RegraDoMapa => ({
  featureType,
  ...(elementType ? { elementType } : {}),
  stylers: [{ visibility: "off" }],
});

const TERRA = "#f5f8f9";
const NOME_DE_BAIRRO = "#6a7f92";
const NOME_DE_RUA = "#8ea0ae";

/**
 * O mapa "azul suave" (design de 2026-11-16, `app-unidades-mapa.md`): branco, azul e cinzas suaves, sem
 * comércios nem ônibus, com as estações de metrô e trem. Só o Google Maps (Android) aplica; o Apple Maps ignora.
 */
export const ESTILO_DO_MAPA: RegraDoMapa[] = [
  cor("landscape", "geometry", TERRA),
  cor("landscape.man_made", "geometry", "#eff4f6"),
  cor("poi.park", "geometry", "#e7f1ef"),
  cor("water", "geometry", "#c9e2f3"),
  cor("landscape.man_made", "geometry.stroke", "#e9eff2"),
  esconder("poi"),
  esconder("transit.line"),
  esconder("transit.station.bus"),
  esconder("transit.station.airport"),
  { featureType: "transit.station.rail", stylers: [{ visibility: "on" }] },
  cor("transit.station.rail", "labels.text.fill", NOME_DE_BAIRRO),
  cor("transit.station.rail", "labels.icon", NOME_DE_BAIRRO),
  esconder("administrative", "geometry"),
  cor("road.local", "geometry.fill", "#ffffff"),
  cor("road.local", "geometry.stroke", "#e1e8ea"),
  cor("road.arterial", "geometry.fill", "#dcecf8"),
  cor("road.arterial", "geometry.stroke", "#bcd8ef"),
  cor("road.highway", "geometry.fill", "#dcecf8"),
  cor("road.highway", "geometry.stroke", "#bcd8ef"),
  esconder("road", "labels.icon"),
  cor("road", "labels.text.fill", NOME_DE_RUA),
  cor("road", "labels.text.stroke", TERRA),
  cor("administrative", "labels.text.fill", NOME_DE_BAIRRO),
  cor("administrative", "labels.text.stroke", TERRA),
];

export type AparenciaDoPino = { cor: string; relevo: string; tamanho: number; nome: boolean };

/** O pino da unidade: verde com atendimento aberto, azul sem; a escolhida cresce e mostra o nome. */
export function aparenciaDoPino(aberto: boolean, escolhido: boolean): AparenciaDoPino {
  return {
    cor: aberto ? COR.verde : COR.action,
    relevo: aberto ? COR.verdeSombra : COR.acaoSombra,
    tamanho: escolhido ? 42 : 34,
    nome: escolhido,
  };
}
