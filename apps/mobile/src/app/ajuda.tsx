import { CalendarX, Clock, IdCard, type LucideIcon, Siren } from "lucide-react-native";
import { Text, View } from "react-native";
import { BotaoLigar, Cartao, COR, FONTE, Tela, Texto, TextoSuave, Titulo } from "@/components/ui";

const PERGUNTAS: { pergunta: string; resposta: string; Icone: LucideIcon; fundo: string; cor: string }[] = [
  {
    pergunta: "é a minha primeira vez na unidade. o que faço?",
    resposta:
      "passe na recepção com um documento com foto (RG ou CNH) e o cartão do SUS, se tiver. eles confirmam os seus dados uma vez só.",
    Icone: IdCard,
    fundo: COR.primary50,
    cor: COR.action,
  },
  {
    pergunta: "e se eu perder a minha vez?",
    resposta:
      "fale com a recepção assim que chegar. dependendo do caso, eles te colocam de volta na fila ou marcam outro dia.",
    Icone: Clock,
    fundo: COR.warningBg,
    cor: COR.warningInk,
  },
  {
    pergunta: "não vou conseguir ir. e agora?",
    resposta:
      "na aba “atendimentos”, toque em “não vou poder ir” no atendimento. assim a vaga fica para outra pessoa, e você pode se inscrever de novo depois.",
    Icone: CalendarX,
    fundo: COR.successBg,
    cor: COR.successInk,
  },
];

/** Ajuda: perguntas comuns em linguagem simples e os telefones de emergência. */
export default function Ajuda() {
  return (
    <Tela>
      <Titulo>ajuda</Titulo>
      <TextoSuave>respostas curtas para as dúvidas mais comuns.</TextoSuave>
      {PERGUNTAS.map(({ pergunta, resposta, Icone, fundo, cor }) => (
        <Cartao key={pergunta} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ padding: 10, borderRadius: 14, backgroundColor: fundo }}>
              <Icone size={24} color={cor} strokeWidth={2.5} />
            </View>
            <Text
              accessibilityRole="header"
              style={{ flex: 1, fontFamily: FONTE.extra, fontSize: 19, lineHeight: 25, color: COR.ink }}
            >
              {pergunta}
            </Text>
          </View>
          <Texto>{resposta}</Texto>
        </Cartao>
      ))}
      <View style={{ gap: 12, padding: 18, borderRadius: 20, backgroundColor: COR.dangerBg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Siren size={28} color={COR.dangerInk} strokeWidth={2.5} />
          <Text
            accessibilityRole="header"
            style={{ flex: 1, fontFamily: FONTE.extra, fontSize: 22, lineHeight: 28, color: COR.dangerInk }}
          >
            é uma emergência?
          </Text>
        </View>
        <Text style={{ fontFamily: FONTE.semi, fontSize: 18, lineHeight: 26, color: COR.dangerInk }}>
          não espere na fila. ligue para o SAMU, de graça, a qualquer hora.
        </Text>
        <BotaoLigar texto="ligar para o SAMU (192)" numero="192" tipo="perigoCheio" />
      </View>
      <Cartao style={{ gap: 10 }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: FONTE.extra, fontSize: 19, lineHeight: 25, color: COR.ink }}
        >
          precisa conversar?
        </Text>
        <Texto>o CVV ouve você com sigilo, de graça, 24 horas por dia.</Texto>
        <BotaoLigar texto="ligar para o CVV (188)" numero="188" tipo="secundario" />
      </Cartao>
    </Tela>
  );
}
