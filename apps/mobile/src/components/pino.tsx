import { Building2 } from "lucide-react-native";
import { Text, View } from "react-native";
import { COR, FONTE } from "@/components/ui";
import { aparenciaDoPino } from "@/lib/mapa";

/**
 * O pino da unidade no mapa (design de 2026-11-16): quadrado com relevo e o ícone de prédio, a pontinha
 * embaixo e, na escolhida, o nome numa pílula em cima. Verde com atendimento aberto, azul sem.
 */
export function PinoDaUnidade({ nome, aberto, escolhido }: { nome: string; aberto: boolean; escolhido: boolean }) {
  const a = aparenciaDoPino(aberto, escolhido);
  return (
    <View style={{ alignItems: "center" }}>
      {a.nome ? (
        <View
          style={{
            marginBottom: 4,
            paddingHorizontal: 10,
            paddingVertical: 2,
            borderRadius: 999,
            borderWidth: 2,
            borderBottomWidth: 3,
            borderColor: COR.linha,
            backgroundColor: COR.surface,
          }}
        >
          <Text numberOfLines={1} style={{ fontFamily: FONTE.extra, fontSize: 12, lineHeight: 16, color: COR.ink }}>
            {nome}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          width: a.tamanho,
          height: a.tamanho,
          borderRadius: escolhido ? 14 : 12,
          borderWidth: escolhido ? 3 : 2,
          borderBottomWidth: 5,
          borderColor: COR.surface,
          borderBottomColor: a.relevo,
          backgroundColor: a.cor,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Building2 size={escolhido ? 20 : 17} color="#ffffff" strokeWidth={2.5} />
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -1,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 8,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: a.relevo,
        }}
      />
    </View>
  );
}
