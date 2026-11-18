import { router } from "expo-router";
import { Bell, DoorOpen, House, type LucideIcon, Megaphone } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { Button, COLOR, FONT, Screen, SoftText, Title } from "@/components/ui";
import { noticeScreen } from "@/lib/notices";
import { useSession } from "@/lib/session";

const EXAMPLES: { text: string; Icon: LucideIcon; background: string; color: string }[] = [
  { text: "hora de sair de casa", Icon: House, background: COLOR.warningBg, color: COLOR.warningInk },
  { text: "venha agora", Icon: DoorOpen, background: COLOR.primary50, color: COLOR.action },
  { text: "é a sua vez!", Icon: Megaphone, background: COLOR.successBg, color: COLOR.successInk },
];

/**
 * Tela 3 do design: por que os avisos importam, antes do pedido do celular (que quase não volta a aparecer).
 * Pelo sininho do topo, a mesma tela mostra como estão os avisos e volta para onde a pessoa estava.
 */
export default function Notices() {
  const s = useSession();
  const [turningOn, setTurningOn] = useState(false);
  const byBell = router.canGoBack();
  const follow = () => (byBell ? router.back() : router.replace("/"));
  const t = noticeScreen(s.notices ?? { kind: "ask" });

  return (
    <Screen
      top={false}
      actions={
        <>
          {t.hint ? <SoftText style={{ textAlign: "center", fontSize: 16, lineHeight: 22 }}>{t.hint}</SoftText> : null}
          {t.button ? (
            <Button
              text={t.button}
              loading={turningOn}
              onPress={async () => {
                setTurningOn(true);
                await s.turnOnNotices();
                setTurningOn(false);
                follow();
              }}
            />
          ) : null}
          <Button
            variant={t.button ? "text" : "primary"}
            text={t.button ? "agora não" : "voltar"}
            onPress={async () => {
              if (t.button) await s.skipNotices();
              follow();
            }}
          />
        </>
      }
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ borderRadius: 28, backgroundColor: COLOR.surfaceMuted, padding: 20, gap: 12, alignItems: "center" }}
      >
        <View style={{ padding: 18, borderRadius: 999, backgroundColor: COLOR.yellow, marginBottom: 4 }}>
          <Bell size={44} color="#ffffff" strokeWidth={2.75} />
        </View>
        {EXAMPLES.map(({ text, Icon, background, color }) => (
          <View
            key={text}
            style={{
              alignSelf: "stretch",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 18,
              borderWidth: 2,
              borderBottomWidth: 4,
              borderColor: COLOR.line,
              backgroundColor: COLOR.surface,
            }}
          >
            <View style={{ padding: 8, borderRadius: 12, backgroundColor: background }}>
              <Icon size={24} color={color} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONT.extra, fontSize: 18, lineHeight: 24, color: COLOR.ink }}>{text}</Text>
              <Text style={{ fontFamily: FONT.semi, fontSize: 14, color: COLOR.inkMuted }}>fila saúde · agora</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ gap: 8 }}>
        <Title style={{ fontSize: 30, lineHeight: 36 }}>{t.title}</Title>
        <SoftText style={{ fontSize: 20, lineHeight: 30 }}>{t.text}</SoftText>
      </View>
    </Screen>
  );
}
