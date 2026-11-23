import Constants, { ExecutionEnvironment } from "expo-constants";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, View } from "react-native";
import MapView, { type LatLng, Marker, type Region } from "react-native-maps";
import { UnitPin } from "@/components/pin";
import { COLOR } from "@/components/ui";
import { MAP_STYLE, nativeMap } from "@/lib/map";
import { MAP_HEIGHT, type MapProps } from "./map.types";

// Região que mostra todos os pontos, com folga nas bordas.
function regionOf(points: LatLng[]): Region {
  if (points.length === 0) return { latitude: -15.78, longitude: -47.93, latitudeDelta: 20, longitudeDelta: 20 };
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.6),
  };
}

/**
 * Sem a chave do Google Maps no Android (build próprio), não há mapa: a tela mostra só a lista.
 * Lê a config que o Metro serve: no build de desenvolvimento, a chave do `.env` de quem roda o Metro
 * precisa ser a mesma do build (G12), senão o Google Maps abre sem chave e trava. Na loja a config vem do build.
 */
export const hasMap = nativeMap({
  os: Platform.OS,
  expoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
  mapsKey: Constants.expoConfig?.android?.config?.googleMaps?.apiKey,
});

/**
 * Mapa de verdade (react-native-maps): Apple Maps no iPhone, Google Maps no Android. Quem usa confere
 * `hasMap` antes (sem a chave do Google, o app travaria).
 */
export default function UnitsMap({
  pins: fresh,
  here,
  selected,
  onTapPin,
  onTapOutside,
  height = MAP_HEIGHT,
}: MapProps) {
  const ref = useRef<MapView>(null);
  // A aba busca as unidades a cada foco e chega um array novo: o mapa só reage quando o conteúdo muda
  // (sem reenquadrar o zoom da pessoa nem redesenhar os pinos à toa).
  const pinsKey = fresh.map((x) => `${x.id}:${x.lat}:${x.lng}:${x.open}:${x.name}`).join("|");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pinsKey` resume o conteúdo dos pinos.
  const pins = useMemo(() => fresh, [pinsKey]);
  const hereKey = here ? `${here.lat}:${here.lng}` : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `hereKey` resume a posição da pessoa.
  const points = useMemo(() => {
    const p: LatLng[] = pins.map((x) => ({ latitude: x.lat, longitude: x.lng }));
    if (here) p.push({ latitude: here.lat, longitude: here.lng });
    return p;
  }, [pins, hereKey]);
  const initial = useMemo(() => regionOf(points), [points]);
  // Android: o pino é uma imagem tirada da View; redesenha só logo depois de mudar a escolha, depois congela.
  const [drawing, setDrawing] = useState(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: redesenha a cada troca de escolha ou de pinos
  useEffect(() => {
    setDrawing(true);
    const id = setTimeout(() => setDrawing(false), 500);
    return () => clearTimeout(id);
  }, [selected, pins]);

  // Chegou a localização (ou a lista): enquadra a pessoa e as unidades.
  useEffect(() => {
    if (points.length > 1)
      ref.current?.fitToCoordinates(points, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
  }, [points]);

  // Unidade escolhida (no mapa ou fora dele): centraliza nela.
  useEffect(() => {
    const p = pins.find((x) => x.id === selected);
    if (p) ref.current?.animateCamera({ center: { latitude: p.lat, longitude: p.lng } }, { duration: 400 });
  }, [selected, pins]);

  return (
    <View
      style={{ height: height, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: COLOR.line }}
      accessibilityLabel="mapa das unidades"
    >
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={initial}
        customMapStyle={MAP_STYLE}
        showsUserLocation={here !== null}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={(ev) => {
          // No iPhone o toque no pino também chega aqui: só limpa quando foi fora de um pino.
          if (ev.nativeEvent.action !== "marker-press") onTapOutside?.();
        }}
      >
        {pins.map((p) => (
          <Marker
            key={`${p.id}-${p.id === selected ? "s" : "n"}`}
            identifier={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={drawing}
            accessibilityLabel={`${p.name}, ${p.open ? "tem atendimento aberto" : "sem atendimento aberto agora"}`}
            zIndex={p.id === selected ? 2 : 1}
            onPress={() => onTapPin(p.id)}
          >
            <UnitPin name={p.name} open={p.open} chosen={p.id === selected} />
          </Marker>
        ))}
      </MapView>
    </View>
  );
}
