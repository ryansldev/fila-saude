import { useEffect, useMemo, useRef } from "react";
import { View } from "react-native";
import MapView, { type LatLng, Marker, type Region } from "react-native-maps";
import { COR } from "@/components/ui";
import { ALTURA_DO_MAPA, type PropsDoMapa } from "./mapa.tipos";

/** Cor do pino: verde com atendimento aberto, azul sem (o texto da lista e do balão também diz). */
export const corDoPino = (aberto: boolean) => (aberto ? COR.verde : COR.action);

// Região que mostra todos os pontos, com folga nas bordas.
function regiaoDe(pontos: LatLng[]): Region {
  if (pontos.length === 0) return { latitude: -15.78, longitude: -47.93, latitudeDelta: 20, longitudeDelta: 20 };
  const lats = pontos.map((p) => p.latitude);
  const lngs = pontos.map((p) => p.longitude);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.6),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.6),
  };
}

/** Mapa de verdade (react-native-maps): Apple Maps no iPhone, Google Maps no Android. */
export default function Mapa({
  pinos,
  aqui,
  selecionado,
  aoTocarPino,
  aoTocarFora,
  altura = ALTURA_DO_MAPA,
}: PropsDoMapa) {
  const ref = useRef<MapView>(null);
  const pontos = useMemo(() => {
    const p: LatLng[] = pinos.map((x) => ({ latitude: x.lat, longitude: x.lng }));
    if (aqui) p.push({ latitude: aqui.lat, longitude: aqui.lng });
    return p;
  }, [pinos, aqui]);
  const inicial = useMemo(() => regiaoDe(pontos), [pontos]);

  // Chegou a localização (ou a lista): enquadra a pessoa e as unidades.
  useEffect(() => {
    if (pontos.length > 1)
      ref.current?.fitToCoordinates(pontos, {
        edgePadding: { top: 48, right: 48, bottom: 48, left: 48 },
        animated: true,
      });
  }, [pontos]);

  // Unidade escolhida (no mapa ou fora dele): centraliza nela.
  useEffect(() => {
    const p = pinos.find((x) => x.id === selecionado);
    if (p) ref.current?.animateCamera({ center: { latitude: p.lat, longitude: p.lng } }, { duration: 400 });
  }, [selecionado, pinos]);

  return (
    <View
      style={{ height: altura, borderRadius: 20, overflow: "hidden", borderWidth: 2, borderColor: COR.linha }}
      accessibilityLabel="mapa das unidades"
    >
      <MapView
        ref={ref}
        style={{ flex: 1 }}
        initialRegion={inicial}
        showsUserLocation={aqui !== null}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={(ev) => {
          // No iPhone o toque no pino também chega aqui: só limpa quando foi fora de um pino.
          if (ev.nativeEvent.action !== "marker-press") aoTocarFora?.();
        }}
      >
        {pinos.map((p) => (
          <Marker
            key={`${p.id}-${p.id === selecionado ? "s" : "n"}`}
            identifier={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.nome}
            description={p.aberto ? "tem atendimento aberto" : "sem atendimento aberto agora"}
            pinColor={p.id === selecionado ? COR.amarelo : corDoPino(p.aberto)}
            zIndex={p.id === selecionado ? 2 : 1}
            onPress={() => aoTocarPino(p.id)}
          />
        ))}
      </MapView>
    </View>
  );
}
