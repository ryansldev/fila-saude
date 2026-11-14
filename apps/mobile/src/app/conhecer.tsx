import { router } from "expo-router";
import { Bell, CalendarCheck, Check, House, QrCode, Smartphone, Tv } from "lucide-react-native";
import { type ReactNode, useState } from "react";
import { Text, View } from "react-native";
import { Botao, CartaoPosicao, COR, Faixa, FONTE, LinkBotao, Selo, Tela, TextoSuave, Titulo } from "@/components/ui";
import { gravar } from "@/lib/armazenamento";
import { CHAVE_ONBOARDING, passoAnterior, proximoPasso } from "@/lib/onboarding";

/** Moldura da ilustração de cada passo: bloco grande e claro, com o desenho centralizado. */
function Quadro({ children, fundo = COR.primary50 }: { children: ReactNode; fundo?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        minHeight: 300,
        borderRadius: 28,
        backgroundColor: fundo,
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

const cartao = {
  alignSelf: "stretch" as const,
  gap: 10,
  padding: 16,
  borderRadius: 20,
  borderWidth: 2,
  borderBottomWidth: 5,
  borderColor: COR.linha,
  backgroundColor: COR.surface,
};

function IlustracaoAgenda() {
  return (
    <Quadro>
      <View style={cartao}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ padding: 10, borderRadius: 14, backgroundColor: COR.primary50 }}>
            <CalendarCheck size={30} color={COR.action} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONTE.extra, fontSize: 20, color: COR.ink }}>clínico geral</Text>
            <Text style={{ fontFamily: FONTE.semi, fontSize: 16, color: COR.inkMuted }}>segunda, 7h às 11h</Text>
          </View>
        </View>
        <Selo texto="tem vaga" tom="verde" />
      </View>
      <View style={[cartao, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }]}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 7,
            backgroundColor: COR.action,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={18} color="#ffffff" strokeWidth={3.5} />
        </View>
        <Text style={{ flex: 1, fontFamily: FONTE.bold, fontSize: 18, color: COR.ink }}>é minha primeira vez</Text>
      </View>
    </Quadro>
  );
}

function IlustracaoCasa() {
  return (
    <Quadro fundo={COR.warningBg}>
      <View style={{ alignSelf: "stretch" }}>
        <CartaoPosicao contexto="clínico geral · ubs centro" posicao={4} detalhe="cerca de 20 min" />
      </View>
      <View style={[cartao, { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }]}>
        <View style={{ padding: 8, borderRadius: 12, backgroundColor: COR.warningBg }}>
          <House size={26} color={COR.warningInk} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 18, color: COR.ink }}>hora de sair de casa</Text>
          <Text style={{ fontFamily: FONTE.semi, fontSize: 15, color: COR.inkMuted }}>fila saúde · agora</Text>
        </View>
        <Bell size={22} color={COR.amarelo} strokeWidth={2.75} />
      </View>
    </Quadro>
  );
}

function IlustracaoQr() {
  return (
    <Quadro>
      {/* A TV da sala de espera, com o QR na tela. */}
      <View style={{ alignItems: "center" }}>
        <View
          style={{
            width: 240,
            paddingVertical: 18,
            borderRadius: 18,
            borderWidth: 8,
            borderColor: COR.primary900,
            backgroundColor: COR.surface,
            alignItems: "center",
            gap: 4,
          }}
        >
          <QrCode size={110} color={COR.primary900} strokeWidth={1.75} />
          <Text style={{ fontFamily: FONTE.extra, fontSize: 15, color: COR.primary900 }}>leia para entrar na fila</Text>
        </View>
        <View style={{ width: 16, height: 14, backgroundColor: COR.primary900 }} />
        <View style={{ width: 90, height: 8, borderRadius: 999, backgroundColor: COR.primary900 }} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Tv size={22} color={COR.actionPressed} strokeWidth={2.5} />
        <Text style={{ fontFamily: FONTE.bold, fontSize: 16, color: COR.actionPressed }}>a tv da sala de espera</Text>
      </View>
    </Quadro>
  );
}

function IlustracaoVez() {
  return (
    <Quadro fundo={COR.successBg}>
      <View
        style={{
          alignSelf: "stretch",
          alignItems: "center",
          gap: 2,
          paddingVertical: 22,
          borderRadius: 24,
          borderBottomWidth: 6,
          borderBottomColor: COR.verdeSombra,
          backgroundColor: COR.call,
        }}
      >
        <Text style={{ fontFamily: FONTE.extra, fontSize: 26, color: "#ffffff" }}>chamando agora</Text>
        <Text style={{ fontFamily: FONTE.bold, fontSize: 16, color: "#ffffffcc", marginTop: 8 }}>senha</Text>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 56, lineHeight: 62, color: "#ffffff" }}>C-012</Text>
        <View
          style={{
            marginTop: 6,
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: "#ffffff",
          }}
        >
          <Text style={{ fontFamily: FONTE.extra, fontSize: 18, color: COR.successInk }}>consultório 3</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Tv size={22} color={COR.successInk} strokeWidth={2.5} />
        <Text style={{ fontFamily: FONTE.bold, fontSize: 16, color: COR.successInk }}>na tv e no celular</Text>
        <Smartphone size={22} color={COR.successInk} strokeWidth={2.5} />
      </View>
    </Quadro>
  );
}

const PASSOS: { titulo: string; texto: string; Ilustracao: () => ReactNode; extra?: ReactNode }[] = [
  {
    titulo: "escolha o atendimento",
    texto: "na agenda do app, escolha o dia e responda umas perguntas rápidas.",
    Ilustracao: IlustracaoAgenda,
  },
  {
    titulo: "espere em casa",
    texto: "você vê a sua posição e quanto falta. a gente avisa a hora de sair de casa.",
    Ilustracao: IlustracaoCasa,
  },
  {
    titulo: "chegou? leia o qr",
    texto: "na unidade, aponte a câmera do celular para o qr na tv da sala de espera.",
    Ilustracao: IlustracaoQr,
    extra: (
      <Faixa tipo="info" titulo="primeira vez na unidade?" texto="passe antes na recepção com um documento com foto." />
    ),
  },
  {
    titulo: "é a sua vez!",
    texto: "a tv e o seu celular mostram a sua senha e a sala para onde ir.",
    Ilustracao: IlustracaoVez,
  },
];

/** "Conhecer o app": 4 passos curtos, um por tela, antes de criar a conta. */
export default function Conhecer() {
  const [passo, setPasso] = useState(0);

  const terminar = async (destino: "/cadastro" | "/entrar" = "/cadastro") => {
    await gravar(CHAVE_ONBOARDING, "visto");
    router.push(destino);
  };
  const ultimo = passo === PASSOS.length - 1;
  const continuar = () => {
    const prox = proximoPasso(passo, PASSOS.length);
    if (prox === "fim") void terminar();
    else setPasso(prox);
  };
  const voltar = () => {
    const ant = passoAnterior(passo);
    if (ant !== "sair") setPasso(ant);
    else if (router.canGoBack()) router.back();
    else router.replace("/boas-vindas");
  };

  const atual = PASSOS[passo];
  if (!atual) return null;
  const { titulo, texto, Ilustracao, extra } = atual;

  return (
    <Tela
      progresso={{ atual: passo + 1, total: PASSOS.length }}
      aoVoltar={voltar}
      acoes={
        <>
          <Botao texto={ultimo ? "criar minha conta" : "continuar"} onPress={continuar} />
          {ultimo ? (
            <LinkBotao texto="já tenho conta" onPress={() => void terminar("/entrar")} />
          ) : (
            <LinkBotao texto="pular" cor={COR.inkMuted} onPress={() => void terminar()} />
          )}
        </>
      }
    >
      <Ilustracao />
      <View style={{ gap: 8, paddingTop: 4 }}>
        <Titulo style={{ fontSize: 30, lineHeight: 36 }}>{titulo}</Titulo>
        <TextoSuave style={{ fontSize: 20, lineHeight: 30 }}>{texto}</TextoSuave>
      </View>
      {extra}
    </Tela>
  );
}
