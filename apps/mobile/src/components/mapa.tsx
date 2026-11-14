import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { COR, FONTE } from "@/components/ui";
import { ALTURA_DO_MAPA, type PropsDoMapa } from "./mapa.tipos";

/** Cor do pino: verde com atendimento aberto, azul sem (o texto da lista também diz). */
export const corDoPino = (aberto: boolean) => (aberto ? COR.verde : COR.action);

// Folga nas bordas: em cima cabe a ponta do pino; embaixo, o aviso de "mapa simplificado".
const FOLGA = { x: 0.12, cima: 0.2, baixo: 0.24 };

/**
 * Web (e qualquer plataforma sem o mapa nativo): o react-native-maps não roda no navegador. No lugar,
 * um "mapa" simples com os pinos na posição relativa de cada unidade, tocáveis como no celular.
 */
export default function Mapa({
  pinos,
  aqui,
  selecionado,
  aoTocarPino,
  aoTocarFora,
  altura = ALTURA_DO_MAPA,
}: PropsDoMapa) {
  const [largura, setLargura] = useState(0);
  const pontos = [...pinos.map((p) => ({ lat: p.lat, lng: p.lng })), ...(aqui ? [aqui] : [])];
  const lats = pontos.map((p) => p.lat);
  const lngs = pontos.map((p) => p.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const posicao = (lat: number, lng: number) => {
    const fx = maxLng === minLng ? 0.5 : (lng - minLng) / (maxLng - minLng);
    const fy = maxLat === minLat ? 0.5 : (maxLat - lat) / (maxLat - minLat);
    return {
      left: (FOLGA.x + fx * (1 - 2 * FOLGA.x)) * largura,
      top: (FOLGA.cima + fy * (1 - FOLGA.cima - FOLGA.baixo)) * altura,
    };
  };

  return (
    <Pressable
      accessibilityLabel="mapa das unidades"
      onPress={aoTocarFora}
      onLayout={(ev) => setLargura(ev.nativeEvent.layout.width)}
      style={{
        height: altura,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: COR.linha,
        backgroundColor: "#eef3ee",
      }}
    >
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
      {largura > 0 && aqui ? (
        <View
          accessibilityLabel="você está aqui"
          style={{
            position: "absolute",
            ...posicao(aqui.lat, aqui.lng),
            width: 22,
            height: 22,
            marginLeft: -11,
            marginTop: -11,
            borderRadius: 999,
            borderWidth: 4,
            borderColor: "#ffffff",
            backgroundColor: COR.primary500,
          }}
        />
      ) : null}
      {largura > 0
        ? pinos.map((p) => {
            const sel = p.id === selecionado;
            const tam = sel ? 44 : 36;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={p.nome}
                accessibilityState={{ selected: sel }}
                onPress={() => aoTocarPino(p.id)}
                hitSlop={8}
                style={{
                  position: "absolute",
                  ...posicao(p.lat, p.lng),
                  marginLeft: -tam / 2,
                  marginTop: -tam,
                  zIndex: sel ? 2 : 1,
                }}
              >
                <MapPin size={tam} color="#ffffff" fill={sel ? COR.amarelo : corDoPino(p.aberto)} strokeWidth={2} />
              </Pressable>
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
        <Text style={{ fontFamily: FONTE.semi, fontSize: 13, color: COR.inkMuted }}>
          mapa simplificado · no celular, o mapa é completo
        </Text>
      </View>
    </Pressable>
  );
}
