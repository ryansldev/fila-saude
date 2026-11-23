import { useState } from "react";
import { Text, View } from "react-native";
import { UnitPin } from "@/components/pin";
import { COLOR, FONT, TappableArea } from "@/components/ui";
import { MAP_HEIGHT, type MapProps } from "./map.types";

// Folga nas bordas: em cima cabe a ponta do pino; embaixo, o aviso de "mapa simplificado".
const SLACK = { x: 0.12, top: 0.2, low: 0.24 };

/** No navegador o mapa simplificado sempre aparece. */
export const hasMap = true;

/**
 * Web (e qualquer plataforma sem o mapa nativo): o react-native-maps não roda no navegador. No lugar,
 * um "mapa" simples com os pinos na posição relativa de cada unidade, tocáveis como no celular.
 */
export default function UnitsMap({ pins, here, selected, onTapPin, onTapOutside, height = MAP_HEIGHT }: MapProps) {
  const [width, setWidth] = useState(0);
  const points = [...pins.map((p) => ({ lat: p.lat, lng: p.lng })), ...(here ? [here] : [])];
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const position = (lat: number, lng: number) => {
    const fx = maxLng === minLng ? 0.5 : (lng - minLng) / (maxLng - minLng);
    const fy = maxLat === minLat ? 0.5 : (maxLat - lat) / (maxLat - minLat);
    return {
      left: (SLACK.x + fx * (1 - 2 * SLACK.x)) * width,
      top: (SLACK.top + fy * (1 - SLACK.top - SLACK.low)) * height,
    };
  };

  return (
    <View
      accessibilityLabel="mapa das unidades"
      onLayout={(ev) => setWidth(ev.nativeEvent.layout.width)}
      style={{
        height: height,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: COLOR.line,
        backgroundColor: "#eef3ee",
      }}
    >
      {/* Tocar fora dos pinos tira a escolha (por baixo de tudo, do tamanho do mapa). */}
      <TappableArea
        label="tirar a escolha do mapa"
        onPress={() => onTapOutside?.()}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      >
        {null}
      </TappableArea>
      {/* Ruas de mentira, só para lembrar um mapa. */}
      {[0.22, 0.5, 0.78].map((f) => (
        <View
          key={`h${f}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${f * 100}%`,
            height: 10,
            backgroundColor: "#ffffff",
          }}
        />
      ))}
      {[0.3, 0.68].map((f) => (
        <View
          key={`v${f}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${f * 100}%`,
            width: 10,
            backgroundColor: "#ffffff",
          }}
        />
      ))}
      {width > 0 && here ? (
        <View
          accessibilityLabel="você está aqui"
          style={{
            position: "absolute",
            ...position(here.lat, here.lng),
            width: 22,
            height: 22,
            marginLeft: -11,
            marginTop: -11,
            borderRadius: 999,
            borderWidth: 4,
            borderColor: "#ffffff",
            backgroundColor: COLOR.primary500,
          }}
        />
      ) : null}
      {width > 0
        ? pins.map((p) => {
            const sel = p.id === selected;
            return (
              <TappableArea
                key={p.id}
                label={p.name}
                selected={sel}
                onPress={() => onTapPin(p.id)}
                style={{
                  position: "absolute",
                  ...position(p.lat, p.lng),
                  transform: [{ translateX: "-50%" }, { translateY: "-100%" }],
                  zIndex: sel ? 2 : 1,
                }}
              >
                <UnitPin name={p.name} open={p.open} chosen={sel} />
              </TappableArea>
            );
          })
        : null}
      <View
        style={{
          position: "absolute",
          left: 10,
          bottom: 10,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: "#ffffffdd",
        }}
      >
        <Text style={{ fontFamily: FONT.semi, fontSize: 13, color: COLOR.inkMuted }}>
          mapa simplificado. no celular, o mapa é completo
        </Text>
      </View>
    </View>
  );
}
