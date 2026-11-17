import { Building2 } from "lucide-react-native";
import { Text, View } from "react-native";
import { COLOR, FONT } from "@/components/ui";
import { pinAppearance } from "@/lib/map";

/**
 * O pino da unidade no mapa (design de 2026-11-16): quadrado com relevo e o ícone de prédio, a pontinha
 * embaixo e, na escolhida, o nome numa pílula em cima. Verde com atendimento aberto, azul sem.
 */
export function UnitPin({ name, open, chosen }: { name: string; open: boolean; chosen: boolean }) {
  const a = pinAppearance(open, chosen);
  return (
    <View style={{ alignItems: "center" }}>
      {a.name ? (
        <View
          style={{
            marginBottom: 4,
            paddingHorizontal: 10,
            paddingVertical: 2,
            borderRadius: 999,
            borderWidth: 2,
            borderBottomWidth: 3,
            borderColor: COLOR.line,
            backgroundColor: COLOR.surface,
          }}
        >
          <Text numberOfLines={1} style={{ fontFamily: FONT.extra, fontSize: 12, lineHeight: 16, color: COLOR.ink }}>
            {name}
          </Text>
        </View>
      ) : null}
      <View
        style={{
          width: a.size,
          height: a.size,
          borderRadius: chosen ? 14 : 12,
          borderWidth: chosen ? 3 : 2,
          borderBottomWidth: 5,
          borderColor: COLOR.surface,
          borderBottomColor: a.relief,
          backgroundColor: a.color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Building2 size={chosen ? 20 : 17} color="#ffffff" strokeWidth={2.5} />
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
          borderTopColor: a.relief,
        }}
      />
    </View>
  );
}
