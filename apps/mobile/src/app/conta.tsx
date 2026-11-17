import { router } from "expo-router";
import {
  BellOff,
  BellRing,
  ChevronRight,
  CircleQuestionMark,
  Lightbulb,
  LogOut,
  type LucideIcon,
  MapPin,
} from "lucide-react-native";
import { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { PatientTabs } from "@/components/care";
import { Badge, Button, COLOR, FONT, Screen, Sheet, Small, SoftText, TappableArea, Title } from "@/components/ui";
import { firstName, hiddenCpf, initials, type Municipality, municipalityName, noticeText } from "@/lib/account";
import { useSession } from "@/lib/session";

/** Aba "conta": quem está no app e um menu simples, como no gov.br e no Meu SUS Digital. */
export default function Account() {
  const s = useSession();
  const [municipalities, setMunicipalities] = useState<Municipality[] | null>(null);
  const [turningOn, setTurningOn] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    s.api
      .get<Municipality[]>("/v1/municipalities")
      .then(setMunicipalities)
      .catch(() => setMunicipalities([]));
  }, [s.api]);

  const currentMunicipalityName = municipalityName(municipalities, s.municipality);
  const notices = noticeText(s.notices);
  const cpf = hiddenCpf(s.account?.cpf ?? "");

  async function leave() {
    setLeaving(true);
    try {
      await s.leave();
    } finally {
      setLeaving(false);
      setConfirmExit(false);
      // Pilha nova: o "voltar" não volta para dentro da conta que saiu.
      if (router.canDismiss()) router.dismissAll();
      router.replace("/boas-vindas");
    }
  }

  return (
    <Screen back={false} footer={<PatientTabs current="account" />}>
      <View style={style.top}>
        <View style={style.avatar} accessibilityElementsHidden importantForAccessibility="no">
          <Text style={style.initials}>{s.account ? initials(s.account.name) : ""}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          {s.account ? (
            <>
              <Title style={{ fontSize: 30, lineHeight: 36 }}>{firstName(s.account.name)}</Title>
              {cpf ? (
                <Text style={style.cpf} accessibilityLabel="CPF escondido. só os números do meio aparecem.">
                  CPF {cpf}
                </Text>
              ) : null}
            </>
          ) : (
            <ActivityIndicator color={COLOR.action} style={{ alignSelf: "flex-start" }} />
          )}
          {s.municipality ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <MapPin size={18} color={COLOR.inkMuted} strokeWidth={2.5} />
              <Small style={{ flex: 1 }}>{currentMunicipalityName ?? "seu município"}</Small>
            </View>
          ) : null}
        </View>
      </View>

      <View style={style.list}>
        <Row
          Icon={MapPin}
          tone="blue"
          label="município"
          description={currentMunicipalityName ?? "toque para escolher"}
          onPress={() => router.push("/municipio")}
        />
        <Divider />
        <Row
          Icon={notices.on ? BellRing : BellOff}
          tone={notices.on ? "green" : "yellow"}
          label="avisos"
          description={notices.text}
          loading={turningOn}
          right={notices.on ? <Badge text="ligados" tone="green" /> : undefined}
          onPress={
            notices.on || !s.notices
              ? undefined
              : async () => {
                  setTurningOn(true);
                  try {
                    await s.turnOnNotices();
                  } finally {
                    setTurningOn(false);
                  }
                }
          }
        />
        <Divider />
        <Row
          Icon={Lightbulb}
          tone="yellow"
          label="como funciona"
          description="veja de novo o passo a passo do app"
          onPress={() => router.push({ pathname: "/conhecer", params: { review: "1" } })}
        />
        <Divider />
        <Row
          Icon={CircleQuestionMark}
          tone="blue"
          label="ajuda"
          description="dúvidas comuns e telefones de emergência"
          onPress={() => router.push("/ajuda")}
        />
      </View>

      <View style={style.list}>
        <Row
          Icon={LogOut}
          tone="red"
          label="sair da conta"
          description="para usar outra conta neste celular"
          danger
          onPress={() => setConfirmExit(true)}
        />
      </View>

      <Sheet open={confirmExit} close={() => setConfirmExit(false)} locked={leaving}>
        <Title>sair da conta?</Title>
        <SoftText>você deixa de receber os avisos neste celular.</SoftText>
        <Button text="sair da conta" variant="danger" loading={leaving} onPress={() => void leave()} />
        <Button text="continuar na conta" variant="secondary" onPress={() => setConfirmExit(false)} />
      </Sheet>
    </Screen>
  );
}

const TONES = {
  blue: { background: COLOR.primary50, color: COLOR.action },
  green: { background: COLOR.successBg, color: COLOR.successInk },
  yellow: { background: COLOR.warningBg, color: COLOR.warningInk },
  red: { background: COLOR.dangerBg, color: COLOR.dangerInk },
};

function Row({
  Icon,
  tone,
  label,
  description,
  onPress,
  right,
  loading = false,
  danger = false,
}: {
  Icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  description: string;
  onPress?: (() => void) | undefined;
  right?: ReactNode;
  loading?: boolean;
  danger?: boolean;
}) {
  const t = TONES[tone];
  const content = (pressed: boolean) => (
    <View style={[style.row, pressed && { backgroundColor: danger ? COLOR.dangerBg : COLOR.primary50 }]}>
      <View style={[style.icon, { backgroundColor: t.background }]}>
        <Icon size={26} color={t.color} strokeWidth={2.5} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[style.label, danger && { color: COLOR.dangerInk }]}>{label}</Text>
        <Text style={style.description}>{description}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={COLOR.action} />
      ) : right ? (
        right
      ) : onPress ? (
        <ChevronRight size={26} color={danger ? COLOR.dangerInk : COLOR.inkMuted} strokeWidth={2.5} />
      ) : null}
    </View>
  );
  if (!onPress)
    return (
      <View accessible accessibilityLabel={`${label}: ${description}`}>
        {content(false)}
      </View>
    );
  return (
    <TappableArea label={label} hint={description} busy={loading} onPress={onPress}>
      {(pressed) => content(pressed)}
    </TappableArea>
  );
}

const Divider = () => <View style={{ height: 2, backgroundColor: COLOR.line, marginLeft: 76 }} />;

const style = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 24,
    backgroundColor: COLOR.primary50,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLOR.action,
    borderBottomWidth: 4,
    borderBottomColor: COLOR.actionShadow,
  },
  initials: { fontFamily: FONT.extra, fontSize: 28, color: "#ffffff", letterSpacing: 1 },
  cpf: { fontFamily: FONT.bold, fontSize: 17, lineHeight: 24, color: COLOR.inkMuted, letterSpacing: 0.5 },
  list: {
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLOR.line,
    backgroundColor: COLOR.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 76,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontFamily: FONT.extra, fontSize: 19, lineHeight: 24, color: COLOR.ink },
  description: { fontFamily: FONT.semi, fontSize: 15, lineHeight: 21, color: COLOR.inkMuted },
});
