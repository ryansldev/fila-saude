import { CalendarX, Clock, IdCard, type LucideIcon, Siren } from "lucide-react-native";
import { Text, View } from "react-native";
import { BodyText, CallButton, Card, COLOR, FONT, Screen, SoftText, Title } from "@/components/ui";

const QUESTIONS: { question: string; answer: string; Icon: LucideIcon; background: string; color: string }[] = [
  {
    question: "é a minha primeira vez na unidade. o que faço?",
    answer:
      "passe na recepção com um documento com foto (RG ou CNH) e o cartão do SUS, se tiver. eles confirmam os seus dados uma vez só.",
    Icon: IdCard,
    background: COLOR.primary50,
    color: COLOR.action,
  },
  {
    question: "e se eu perder a minha vez?",
    answer:
      "fale com a recepção assim que chegar. dependendo do caso, eles te colocam de volta na fila ou marcam outro dia.",
    Icon: Clock,
    background: COLOR.warningBg,
    color: COLOR.warningInk,
  },
  {
    question: "não vou conseguir ir. e agora?",
    answer:
      "na aba “atendimentos”, toque em “não vou poder ir” no atendimento. assim a vaga fica para outra pessoa, e você pode se inscrever de novo depois.",
    Icon: CalendarX,
    background: COLOR.successBg,
    color: COLOR.successInk,
  },
];

/** Ajuda: perguntas comuns em linguagem simples e os telefones de emergência. */
export default function Help() {
  return (
    <Screen>
      <Title>ajuda</Title>
      <SoftText>respostas curtas para as dúvidas mais comuns.</SoftText>
      {QUESTIONS.map(({ question, answer, Icon, background, color }) => (
        <Card key={question} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ padding: 10, borderRadius: 14, backgroundColor: background }}>
              <Icon size={24} color={color} strokeWidth={2.5} />
            </View>
            <Text
              accessibilityRole="header"
              style={{ flex: 1, fontFamily: FONT.extra, fontSize: 19, lineHeight: 25, color: COLOR.ink }}
            >
              {question}
            </Text>
          </View>
          <BodyText>{answer}</BodyText>
        </Card>
      ))}
      <View style={{ gap: 12, padding: 18, borderRadius: 20, backgroundColor: COLOR.dangerBg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Siren size={28} color={COLOR.dangerInk} strokeWidth={2.5} />
          <Text
            accessibilityRole="header"
            style={{ flex: 1, fontFamily: FONT.extra, fontSize: 22, lineHeight: 28, color: COLOR.dangerInk }}
          >
            é uma emergência?
          </Text>
        </View>
        <Text style={{ fontFamily: FONT.semi, fontSize: 18, lineHeight: 26, color: COLOR.dangerInk }}>
          não espere na fila. ligue para o SAMU, de graça, a qualquer hora.
        </Text>
        <CallButton text="ligar para o SAMU (192)" number="192" variant="danger" />
      </View>
      <Card style={{ gap: 10 }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: FONT.extra, fontSize: 19, lineHeight: 25, color: COLOR.ink }}
        >
          precisa conversar?
        </Text>
        <BodyText>o CVV ouve você com sigilo, de graça, 24 horas por dia.</BodyText>
        <CallButton text="ligar para o CVV (188)" number="188" variant="secondary" />
      </Card>
    </Screen>
  );
}
