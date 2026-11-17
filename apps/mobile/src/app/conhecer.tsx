import { router } from "expo-router";
import { Bell, CalendarCheck, Check, House, QrCode, Smartphone, Tv } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Text, View } from "react-native";
import { Badge, Banner, Button, COLOR, FONT, PositionCard, Screen, SoftText, Title } from "@/components/ui";
import { KEY_ONBOARDING, nextStep, previousStep } from "@/lib/onboarding";
import { save } from "@/lib/storage";

/** Moldura da ilustração de cada passo: bloco grande e claro, com o desenho centralizado. */
function Box({ children, background = COLOR.primary50 }: { children: ReactNode; background?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        minHeight: 300,
        borderRadius: 28,
        backgroundColor: background,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        gap: 14,
      }}
    >
      {children}
    </View>
  );
}

const card = {
  alignSelf: "stretch" as const,
  gap: 10,
  padding: 16,
  borderRadius: 20,
  borderWidth: 2,
  borderBottomWidth: 5,
  borderColor: COLOR.line,
  backgroundColor: COLOR.surface,
};

function ScheduleIllustration() {
  return (
    <Box>
      <View style={card}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ padding: 10, borderRadius: 14, backgroundColor: COLOR.primary50 }}>
            <CalendarCheck size={30} color={COLOR.action} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONT.extra, fontSize: 20, color: COLOR.ink }}>clínico geral</Text>
            <Text style={{ fontFamily: FONT.semi, fontSize: 16, color: COLOR.inkMuted }}>segunda, 7h às 11h</Text>
          </View>
        </View>
        <Badge text="tem vaga" tone="green" />
      </View>
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }]}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            backgroundColor: COLOR.action,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={18} color="#ffffff" strokeWidth={3.5} />
        </View>
        <Text style={{ flex: 1, fontFamily: FONT.bold, fontSize: 18, color: COLOR.ink }}>é minha primeira vez</Text>
      </View>
    </Box>
  );
}

function HomeIllustration() {
  return (
    <Box background={COLOR.warningBg}>
      <View style={{ alignSelf: "stretch" }}>
        <PositionCard context="clínico geral · ubs centro" position={4} detail="cerca de 20 min" />
      </View>
      <View style={[card, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }]}>
        <View style={{ padding: 8, borderRadius: 12, backgroundColor: COLOR.warningBg }}>
          <House size={26} color={COLOR.warningInk} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONT.extra, fontSize: 18, color: COLOR.ink }}>hora de sair de casa</Text>
          <Text style={{ fontFamily: FONT.semi, fontSize: 15, color: COLOR.inkMuted }}>fila saúde · agora</Text>
        </View>
        <Bell size={22} color={COLOR.yellow} strokeWidth={2.75} />
      </View>
    </Box>
  );
}

function QrIllustration() {
  return (
    <Box>
      {/* A TV da sala de espera, com o QR na tela. */}
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 240,
            paddingVertical: 18,
            borderRadius: 18,
            borderWidth: 8,
            borderColor: COLOR.primary900,
            backgroundColor: COLOR.surface,
            alignItems: "center",
            gap: 4,
          }}
        >
          <QrCode size={110} color={COLOR.primary900} strokeWidth={1.75} />
          <Text style={{ fontFamily: FONT.extra, fontSize: 15, color: COLOR.primary900 }}>
            leia para entrar na fila
          </Text>
        </View>
        <View style={{ width: 16, height: 14, backgroundColor: COLOR.primary900 }} />
        <View style={{ width: 90, height: 8, borderRadius: 999, backgroundColor: COLOR.primary900 }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Tv size={22} color={COLOR.actionPressed} strokeWidth={2.5} />
        <Text style={{ fontFamily: FONT.bold, fontSize: 16, color: COLOR.actionPressed }}>a tv da sala de espera</Text>
      </View>
    </Box>
  );
}

function TurnIllustration() {
  return (
    <Box background={COLOR.successBg}>
      <View
        style={{
          alignSelf: "stretch",
          alignItems: "center",
          gap: 2,
          paddingVertical: 22,
          borderRadius: 24,
          borderBottomWidth: 6,
          borderBottomColor: COLOR.greenShadow,
          backgroundColor: COLOR.call,
        }}
      >
        <Text style={{ fontFamily: FONT.extra, fontSize: 26, color: "#ffffff" }}>chamando agora</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 16, color: "#ffffffcc", marginTop: 8 }}>senha</Text>
        <Text style={{ fontFamily: FONT.extra, fontSize: 56, lineHeight: 62, color: "#ffffff" }}>C-012</Text>
        <View
          style={{
            marginTop: 6,
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: "#ffffff",
          }}
        >
          <Text style={{ fontFamily: FONT.extra, fontSize: 18, color: COLOR.successInk }}>consultório 3</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Tv size={22} color={COLOR.successInk} strokeWidth={2.5} />
        <Text style={{ fontFamily: FONT.bold, fontSize: 16, color: COLOR.successInk }}>na tv e no celular</Text>
        <Smartphone size={22} color={COLOR.successInk} strokeWidth={2.5} />
      </View>
    </Box>
  );
}

const STEPS: { title: string; text: string; Illustration: () => ReactNode; extra?: ReactNode }[] = [
  {
    title: "escolha o atendimento",
    text: "na agenda do app, escolha o dia e responda umas perguntas rápidas.",
    Illustration: ScheduleIllustration,
  },
  {
    title: "espere em casa",
    text: "você vê a sua posição e quanto falta. a gente avisa a hora de sair de casa.",
    Illustration: HomeIllustration,
  },
  {
    title: "chegou? leia o qr",
    text: "na unidade, aponte a câmera do celular para o qr na tv da sala de espera.",
    Illustration: QrIllustration,
    extra: (
      <Banner kind="info" title="primeira vez na unidade?" text="passe antes na recepção com um documento com foto." />
    ),
  },
  {
    title: "é a sua vez!",
    text: "a tv e o seu celular mostram a sua senha e a sala para onde ir.",
    Illustration: TurnIllustration,
  },
];

/** "Conhecer o app": 4 passos curtos, um por tela, antes de criar a conta. */
export default function Intro() {
  const [step, setStep] = useState(0);

  const finish = async (destination: "/cadastro" | "/entrar" = "/cadastro") => {
    await save(KEY_ONBOARDING, "visto");
    router.push(destination);
  };
  const last = step === STEPS.length - 1;
  const proceed = () => {
    const next = nextStep(step, STEPS.length);
    if (next === "end") void finish();
    else setStep(next);
  };
  const back = () => {
    const ant = previousStep(step);
    if (ant !== "leave") setStep(ant);
    else if (router.canGoBack()) router.back();
    else router.replace("/boas-vindas");
  };

  const current = STEPS[step];
  if (!current) return null;
  const { title, text, Illustration, extra } = current;

  return (
    <Screen
      progress={{ current: step + 1, total: STEPS.length }}
      onBack={back}
      actions={
        <>
          <Button text={last ? "criar minha conta" : "continuar"} onPress={proceed} />
          {last ? (
            <Button variant="text" text="já tenho conta" onPress={() => void finish("/entrar")} />
          ) : (
            <Button variant="text" text="pular" onPress={() => void finish()} />
          )}
        </>
      }
    >
      <Illustration />
      <View style={{ gap: 8, paddingTop: 4 }}>
        <Title style={{ fontSize: 30, lineHeight: 36 }}>{title}</Title>
        <SoftText style={{ fontSize: 20, lineHeight: 30 }}>{text}</SoftText>
      </View>
      {extra}
    </Screen>
  );
}
