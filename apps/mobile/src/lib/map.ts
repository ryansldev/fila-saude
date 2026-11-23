import { COLOR } from "@fila-saude/design";

/** Uma regra de estilo do Google Maps (o `customMapStyle` do react-native-maps). */
export type MapRule = { featureType?: string; elementType?: string; stylers: object[] };

const color = (featureType: string, elementType: string, color: string): MapRule => ({
  featureType,
  elementType,
  stylers: [{ color }],
});
const hide = (featureType: string, elementType?: string): MapRule => ({
  featureType,
  ...(elementType ? { elementType } : {}),
  stylers: [{ visibility: "off" }],
});

const LAND = "#f5f8f9";
const NEIGHBORHOOD_NAME = "#6a7f92";
const STREET_NAME = "#8ea0ae";

/**
 * O mapa "azul suave" (design de 2026-11-16, `app-unidades-mapa.md`): branco, azul e cinzas suaves, sem
 * comércios nem ônibus, com as estações de metrô e trem. Só o Google Maps (Android) aplica; o Apple Maps ignora.
 */
export const MAP_STYLE: MapRule[] = [
  color("landscape", "geometry", LAND),
  color("landscape.man_made", "geometry", "#eff4f6"),
  color("poi.park", "geometry", "#e7f1ef"),
  color("water", "geometry", "#c9e2f3"),
  color("landscape.man_made", "geometry.stroke", "#e9eff2"),
  hide("poi"),
  hide("transit.line"),
  hide("transit.station.bus"),
  hide("transit.station.airport"),
  { featureType: "transit.station.rail", stylers: [{ visibility: "on" }] },
  color("transit.station.rail", "labels.text.fill", NEIGHBORHOOD_NAME),
  color("transit.station.rail", "labels.icon", NEIGHBORHOOD_NAME),
  hide("administrative", "geometry"),
  color("road.local", "geometry.fill", "#ffffff"),
  color("road.local", "geometry.stroke", "#e1e8ea"),
  color("road.arterial", "geometry.fill", "#dcecf8"),
  color("road.arterial", "geometry.stroke", "#bcd8ef"),
  color("road.highway", "geometry.fill", "#dcecf8"),
  color("road.highway", "geometry.stroke", "#bcd8ef"),
  hide("road", "labels.icon"),
  color("road", "labels.text.fill", STREET_NAME),
  color("road", "labels.text.stroke", LAND),
  color("administrative", "labels.text.fill", NEIGHBORHOOD_NAME),
  color("administrative", "labels.text.stroke", LAND),
];

export type PinAppearance = { color: string; relief: string; size: number; name: boolean };

/** O pino da unidade: verde com atendimento aberto, azul sem; a escolhida cresce e mostra o nome. */
export function pinAppearance(open: boolean, chosen: boolean): PinAppearance {
  return {
    color: open ? COLOR.green : COLOR.action,
    relief: open ? COLOR.greenShadow : COLOR.actionShadow,
    size: chosen ? 42 : 34,
    name: chosen,
  };
}

/**
 * O react-native-maps no Android é o Google Maps, que trava o app sem a chave no build. No Expo Go a chave
 * é a dele; num build próprio, só se o build levou `GOOGLE_MAPS_ANDROID_API_KEY`. Sem ela, a aba mostra só a lista.
 */
export function nativeMap(env: { os: string; expoGo: boolean; builtWithMaps: boolean }): boolean {
  if (env.os !== "android" || env.expoGo) return true;
  return env.builtWithMaps;
}

/**
 * Lê a marca `extra.googleMaps` da config gravada no build (o `app.config.ts` a liga quando há a chave).
 * A chave em si não serve: a config pública do build não leva `android.config`, e a do Metro, no build de
 * desenvolvimento, é a da máquina de quem roda, não a do build. No Android a config gravada vem como texto JSON.
 */
export function builtWithGoogleMaps(embedded: unknown): boolean {
  let config = embedded;
  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch {
      return false;
    }
  }
  return (config as { extra?: { googleMaps?: unknown } } | null | undefined)?.extra?.googleMaps === true;
}
