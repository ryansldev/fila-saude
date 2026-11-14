import { BottomSheet, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { router } from "expo-router";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleUserRound,
  House,
  Info,
  type LucideIcon,
  MapPin,
  TriangleAlert,
  X,
} from "lucide-react-native";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, SvgXml } from "react-native-svg";
import { MASCOTE_SVG } from "./mascote-svg";

// Tokens do design system "Fila Saúde" (artifact do app do paciente).
export const COR = {
  surface: "#ffffff",
  surfaceMuted: "#eff5f5",
  ink: "#111313",
  inkMuted: "#646b6c",
  border: "#bac8ca",
  primary50: "#eaf5f9",
  primary500: "#2e86de",
  action: "#1a73c8",
  actionPressed: "#185b9a",
  primary900: "#0c2e4e",
  warningBg: "#fffae8",
  warningInk: "#66520a",
  successBg: "#eef7f0",
  successInk: "#00530c",
  dangerBg: "#fef2f1",
  dangerInk: "#993029",
  call: "#30833c",
  // Estilo "chunky" (botões e cartões com relevo, borda grossa clara).
  linha: "#e1e8ea",
  campoFundo: "#f6f9fa",
  acaoSombra: "#145a9b",
  verde: "#2f9e44",
  verdeSombra: "#237a34",
  amarelo: "#f59f00",
};

export const FONTE = {
  regular: "Nunito_400Regular",
  semi: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extra: "Nunito_800ExtraBold",
};

export function Logo({
  tamanho = 28,
  cor = COR.primary500,
  miolo = "#ffffff",
}: {
  tamanho?: number;
  cor?: string;
  miolo?: string;
}) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 64 64" accessibilityElementsHidden>
      <Path
        fill={cor}
        d="M5.127 23.609C6.564 36.242 20.52 48.093 29.33 54.212a4.673 4.673 0 0 0 5.34 0c8.81-6.119 22.767-17.97 24.203-30.603C60.863 6.099 38.967 3.972 32 13.977 25.033 3.972 3.137 6.1 5.127 23.61Z"
      />
      <Path
        fill={miolo}
        d="M28.704 21.09a2.583 2.583 0 0 1 2.583-2.584h2.583a2.583 2.583 0 0 1 2.583 2.583v20.665a2.583 2.583 0 0 1-2.583 2.583h-2.583a2.583 2.583 0 0 1-2.583-2.583V21.09Z"
      />
      <Path
        fill={miolo}
        d="M19.663 30.13a2.583 2.583 0 0 1 2.583-2.583H42.91a2.583 2.583 0 0 1 2.583 2.583v2.583a2.583 2.583 0 0 1-2.583 2.583H22.246a2.583 2.583 0 0 1-2.583-2.583V30.13Z"
      />
    </Svg>
  );
}

/**
 * O mascote só aparece sobre branco (o jaleco é transparente).
 * `moldura`: o cantinho branco ao redor; desliga quando o fundo da tela já é branco (fala do Dr.).
 */
export function Mascote({ tamanho = 200, moldura = true }: { tamanho?: number; moldura?: boolean }) {
  const desenho = (
    <SvgXml xml={MASCOTE_SVG} width={tamanho} height={tamanho} accessibilityLabel="mascote do fila saúde" />
  );
  if (!moldura) return desenho;
  return (
    <View style={{ alignSelf: "center", backgroundColor: COR.surface, padding: 8, borderRadius: 16 }}>{desenho}</View>
  );
}

/** Topo das telas: seta à esquerda quando dá para voltar; depois o logo e "fila saúde". */
export function Topo({ voltar = false, aoVoltar }: { voltar?: boolean; aoVoltar?: (() => void) | undefined }) {
  const aoPressionar = aoVoltar ?? (voltar && router.canGoBack() ? () => router.back() : undefined);
  return (
    <View style={e.topo}>
      {aoPressionar ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="voltar"
          onPress={aoPressionar}
          hitSlop={12}
          style={({ pressed }) => [{ padding: 4, marginLeft: -4, borderRadius: 999 }, pressed && { opacity: 0.5 }]}
        >
          <ChevronLeft size={32} color={COR.ink} strokeWidth={2.5} />
        </Pressable>
      ) : null}
      <Logo />
      <Text style={e.marca}>fila saúde</Text>
      <View style={{ flex: 1 }} />
    </View>
  );
}

/**
 * Mensagem do Dr., como no protótipo (lesson-say): personagem à esquerda, balão na altura do peito,
 * pontinha apontando para ele. Tudo sobre branco por causa do jaleco.
 */
export function FalaDoDr({
  cumprimento,
  nome,
  texto,
}: {
  cumprimento: string;
  nome?: string | undefined;
  texto: string;
}) {
  const titulo = nome ? `${cumprimento}, ${nome}!` : `${cumprimento}!`;
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`dr.: ${titulo} ${texto}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
    >
      <View style={{ width: 96, alignItems: "center" }}>
        <Mascote tamanho={92} moldura={false} />
      </View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View
          pointerEvents="none"
          style={{
            width: 14,
            height: 14,
            marginRight: -8,
            backgroundColor: COR.surface,
            borderLeftWidth: 2,
            borderBottomWidth: 2,
            borderColor: COR.linha,
            transform: [{ rotate: "45deg" }],
            zIndex: 1,
          }}
        />
        <View
          style={{
            flex: 1,
            gap: 6,
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 20,
            borderTopLeftRadius: 6,
            borderWidth: 2,
            borderBottomWidth: 4,
            borderColor: COR.linha,
            backgroundColor: COR.surface,
          }}
        >
          <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>{titulo}</Text>
          <Text style={{ fontFamily: FONTE.semi, fontSize: 16, lineHeight: 24, color: COR.inkMuted }}>{texto}</Text>
        </View>
      </View>
    </View>
  );
}

export function Tela({
  children,
  topo = true,
  voltar = true,
  rodape,
  acoes,
  progresso,
  fundo = COR.surface,
  aoVoltar,
}: {
  children: ReactNode;
  topo?: boolean;
  voltar?: boolean;
  /** Fluxo de vários passos: "voltar" vai ao passo anterior em vez de sair (e perder o que foi digitado). */
  aoVoltar?: () => void;
  rodape?: ReactNode;
  /** Botões da tela, sempre fixos embaixo e alinhados (principal em cima, secundário embaixo). */
  acoes?: ReactNode;
  /** Fluxos: barra de progresso no lugar do topo com a marca. */
  progresso?: { atual: number; total: number };
  fundo?: string;
}) {
  // Botão "voltar" do Android: com `aoVoltar`, vai ao passo anterior em vez de sair da tela.
  const voltarRef = useRef(aoVoltar);
  voltarRef.current = aoVoltar;
  const temAoVoltar = Boolean(aoVoltar);
  useEffect(() => {
    if (!temAoVoltar) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!voltarRef.current) return false;
      voltarRef.current();
      return true;
    });
    return () => sub.remove();
  }, [temAoVoltar]);
  // Android edge-to-edge não redimensiona a janela com o teclado: sem o "padding" ele cobre o rodapé.
  return (
    <SafeAreaView style={[e.tela, { backgroundColor: fundo }]} edges={["top", "bottom"]}>
      {progresso ? (
        <BarraDeProgresso
          atual={progresso.atual}
          total={progresso.total}
          aoFechar={aoVoltar ?? (router.canGoBack() ? () => router.back() : undefined)}
        />
      ) : topo ? (
        <Topo voltar={voltar} aoVoltar={aoVoltar} />
      ) : null}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={e.scr} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
        {acoes ? <View style={e.rodape}>{acoes}</View> : null}
        {rodape}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Enquanto busca: logo e roda girando, para não parecer tela travada. */
export function Carregando({ texto, cheia = false }: { texto?: string; cheia?: boolean }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={texto ?? "carregando"}
      style={[{ alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 32 }, cheia && e.cheia]}
    >
      {cheia ? <Logo tamanho={64} /> : null}
      <ActivityIndicator size="large" color={COR.action} />
      {texto ? <Text style={[e.pm, { textAlign: "center" }]}>{texto}</Text> : null}
    </View>
  );
}

/** Gaveta nativa que sobe de baixo (confirmações, escolhas): o gesto que o paciente já conhece do celular. */
export function Gaveta({
  aberta,
  fechar,
  travada = false,
  children,
}: {
  aberta: boolean;
  fechar: () => void;
  /** Enquanto algo está sendo enviado, o gesto de puxar para baixo não fecha. */
  travada?: boolean;
  children: ReactNode;
}) {
  return (
    <BottomSheet
      index={aberta ? 0 : -1}
      enablePanDownToClose={!travada}
      onClose={fechar}
      backgroundStyle={{ backgroundColor: COR.surface }}
    >
      <BottomSheetView style={e.gaveta}>{children}</BottomSheetView>
    </BottomSheet>
  );
}

export const Espaco = () => <View style={{ flex: 1, minHeight: 8 }} />;

export function Titulo({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return (
    <Text accessibilityRole="header" style={[e.h1, style]}>
      {children}
    </Text>
  );
}
export const Texto = ({ children, style }: { children: ReactNode; style?: TextStyle }) => (
  <Text style={[e.p, style]}>{children}</Text>
);
export const TextoSuave = ({ children, style }: { children: ReactNode; style?: TextStyle }) => (
  <Text style={[e.pm, style]}>{children}</Text>
);
export const Pequeno = ({ children, style }: { children: ReactNode; style?: TextStyle }) => (
  <Text style={[e.small, style]}>{children}</Text>
);
export const Progresso = ({ children }: { children: ReactNode }) => <Text style={e.prog}>{children}</Text>;

type TipoBotao = "primario" | "secundario" | "perigo" | "perigoCheio" | "branco";

// Botão com relevo: a borda de baixo, mais escura, "afunda" ao tocar (o gesto fica visível).
const ESTILO_BOTAO: Record<TipoBotao, { fundo: string; borda: string; sombra: string; texto: string }> = {
  primario: { fundo: COR.action, borda: COR.action, sombra: COR.acaoSombra, texto: "#ffffff" },
  secundario: { fundo: COR.surface, borda: COR.linha, sombra: COR.linha, texto: COR.action },
  perigo: { fundo: COR.surface, borda: COR.linha, sombra: COR.linha, texto: COR.dangerInk },
  perigoCheio: { fundo: COR.dangerInk, borda: COR.dangerInk, sombra: "#6e1f1a", texto: "#ffffff" },
  branco: { fundo: "#ffffff", borda: "#ffffff", sombra: "#d9e2e4", texto: COR.primary900 },
};

export function Botao({
  texto,
  onPress,
  tipo = "primario",
  carregando = false,
  desativado = false,
  corTexto,
}: {
  texto: string;
  onPress: () => void;
  tipo?: TipoBotao;
  carregando?: boolean;
  desativado?: boolean;
  corTexto?: string;
}) {
  const c = ESTILO_BOTAO[tipo];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: desativado || carregando, busy: carregando }}
      disabled={desativado || carregando}
      onPress={onPress}
      style={({ pressed }) => [
        e.btn,
        {
          backgroundColor: c.fundo,
          borderColor: c.borda,
          borderBottomColor: c.sombra,
          borderBottomWidth: pressed ? 2 : 5,
          marginTop: pressed ? 3 : 0,
          opacity: desativado ? 0.45 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {carregando ? <ActivityIndicator color={corTexto ?? c.texto} /> : null}
        <Text style={[e.textoBtn, { color: corTexto ?? c.texto }]}>{carregando ? "aguarde…" : texto}</Text>
      </View>
    </Pressable>
  );
}

/** Botão de ligar (192, 188): abre o discador. */
export const BotaoLigar = ({
  texto,
  numero,
  tipo = "primario",
}: {
  texto: string;
  numero: string;
  tipo?: TipoBotao;
}) => <Botao texto={texto} tipo={tipo} onPress={() => void Linking.openURL(`tel:${numero}`)} />;

export function LinkBotao({
  texto,
  onPress,
  cor = COR.actionPressed,
}: {
  texto: string;
  onPress: () => void;
  cor?: string;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={e.link}>
      <Text style={[e.textoLink, { color: cor }]}>{texto}</Text>
    </Pressable>
  );
}

export function Campo({ rotulo, erro, ...props }: { rotulo: string; erro?: string | undefined } & TextInputProps) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={e.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        accessibilityHint={erro}
        placeholderTextColor="#9aa3a5"
        style={[
          e.campo,
          foco && { borderColor: COR.action, backgroundColor: COR.surface },
          erro ? { borderColor: COR.dangerInk, backgroundColor: COR.dangerBg } : null,
        ]}
        {...props}
        onFocus={(ev) => {
          setFoco(true);
          props.onFocus?.(ev);
        }}
        onBlur={(ev) => {
          setFoco(false);
          props.onBlur?.(ev);
        }}
      />
      {erro ? <Text style={{ fontFamily: FONTE.regular, fontSize: 16, color: COR.dangerInk }}>{erro}</Text> : null}
    </View>
  );
}

/** Senha com "mostrar": digitar no celular sem ver o que digitou trava muita gente. */
export function CampoSenha({ rotulo, erro, ...props }: { rotulo: string; erro?: string | undefined } & TextInputProps) {
  const [ver, setVer] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Campo rotulo={rotulo} erro={erro} secureTextEntry={!ver} autoCapitalize="none" autoCorrect={false} {...props} />
      <LinkBotao texto={ver ? "esconder senha" : "mostrar senha"} onPress={() => setVer(!ver)} />
    </View>
  );
}

/** Opção do questionário: quadrado = várias; redondo = uma só. */
export function Opcao({
  texto,
  marcada,
  onPress,
  unica = false,
}: {
  texto: string;
  marcada: boolean;
  onPress: () => void;
  unica?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={unica ? "radio" : "checkbox"}
      accessibilityState={{ checked: marcada }}
      onPress={onPress}
      style={[e.opt, marcada && { borderColor: COR.action, backgroundColor: COR.primary50 }]}
    >
      <View
        style={[
          e.box,
          unica && { borderRadius: 999 },
          marcada && { backgroundColor: COR.action, borderColor: COR.action },
        ]}
      >
        {marcada ? <Check size={18} color="#ffffff" strokeWidth={3.5} /> : null}
      </View>
      <Text style={e.textoOpt}>{texto}</Text>
    </Pressable>
  );
}

type TipoFaixa = "aviso" | "info" | "perigo" | "ok";
const FAIXA: Record<TipoFaixa, { fundo: string; cor: string; Icone: LucideIcon }> = {
  aviso: { fundo: COR.warningBg, cor: COR.warningInk, Icone: TriangleAlert },
  info: { fundo: COR.primary50, cor: COR.actionPressed, Icone: Info },
  perigo: { fundo: COR.dangerBg, cor: COR.dangerInk, Icone: CircleAlert },
  ok: { fundo: COR.successBg, cor: COR.successInk, Icone: CircleCheck },
};

/** Faixa de aviso do design: ícone, título forte, texto e, quando há o que fazer, um botão. */
export function Faixa({
  tipo,
  titulo,
  texto,
  grande = false,
  acao,
  style,
}: {
  tipo: TipoFaixa;
  titulo: string;
  texto?: string | undefined;
  grande?: boolean;
  acao?: { texto: string; onPress: () => void; carregando?: boolean } | undefined;
  style?: ViewStyle;
}) {
  const { fundo, cor, Icone } = FAIXA[tipo];
  return (
    <View
      accessibilityRole={tipo === "perigo" || tipo === "aviso" ? "alert" : "summary"}
      style={[e.faixa, { backgroundColor: fundo }, grande && { paddingVertical: 20 }, style]}
    >
      <Icone size={grande ? 30 : 26} color={cor} strokeWidth={2.5} style={{ marginTop: grande ? 0 : 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[e.ft, { color: cor }, grande && { fontSize: 24, lineHeight: 30 }]}>{titulo}</Text>
        {texto ? <Text style={[e.fs, { color: cor }]}>{texto}</Text> : null}
        {acao ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: acao.carregando ?? false }}
            disabled={acao.carregando}
            onPress={acao.onPress}
            style={({ pressed }) => [e.acaoFaixa, { borderColor: cor }, pressed && { opacity: 0.6 }]}
          >
            {acao.carregando ? <ActivityIndicator color={cor} /> : null}
            <Text style={[e.textoBtn, { color: cor, fontSize: 17 }]}>{acao.carregando ? "aguarde…" : acao.texto}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[e.card, style]}>{children}</View>;
}

/** Cartão inteiro tocável, com a seta e o que acontece ao tocar: na lista, cada item não vira um botão azul. */
export function CartaoTocavel({ children, acao, onPress }: { children: ReactNode; acao: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={acao}
      onPress={onPress}
      style={({ pressed }) => [
        e.card,
        { flexDirection: "row", alignItems: "center", gap: 12 },
        pressed && { backgroundColor: COR.primary50, borderColor: COR.action },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        {children}
        <Text style={{ fontFamily: FONTE.extra, fontSize: 18, lineHeight: 24, color: COR.action, marginTop: 4 }}>
          {acao}
        </Text>
      </View>
      <ChevronRight size={28} color={COR.action} strokeWidth={2.5} />
    </Pressable>
  );
}

/** Cartão da posição: o maior texto da tela. */
export function CartaoPosicao({ contexto, posicao, detalhe }: { contexto: string; posicao: number; detalhe?: string }) {
  return (
    <View style={e.pos} accessibilityLabel={`você é o ${posicao}º da fila`}>
      <Pequeno>{contexto}</Pequeno>
      <Text style={e.num}>{posicao}º</Text>
      <Text style={[e.p, { fontFamily: FONTE.bold }]}>da fila</Text>
      {detalhe ? <Pequeno>{detalhe}</Pequeno> : null}
    </View>
  );
}

export function Chip({ texto }: { texto: string }) {
  return (
    <View style={e.chip}>
      <Text style={{ fontFamily: FONTE.bold, fontSize: 15, color: COR.ink }}>{texto}</Text>
    </View>
  );
}

/** Abas de baixo: minha fila e unidades. */
export type AbaDoApp = "hoje" | "atendimentos" | "unidades" | "conta";

const ABAS: {
  id: AbaDoApp;
  rotulo: string;
  destino: "/inicio" | "/atendimentos" | "/unidades" | "/conta";
  Icone: LucideIcon;
}[] = [
  { id: "hoje", rotulo: "hoje", destino: "/inicio", Icone: House },
  { id: "atendimentos", rotulo: "atendimentos", destino: "/atendimentos", Icone: CalendarDays },
  { id: "unidades", rotulo: "unidades", destino: "/unidades", Icone: MapPin },
  { id: "conta", rotulo: "conta", destino: "/conta", Icone: CircleUserRound },
];

/** Abas de baixo, como em apps de governo e no Duolingo: ícone grande, rótulo curto, a atual em destaque. */
export function Abas({ atual }: { atual: AbaDoApp }) {
  return (
    <View style={e.abas} accessibilityRole="tablist">
      {ABAS.map(({ id, rotulo, destino, Icone }) => {
        const ativa = atual === id;
        const cor = ativa ? COR.action : COR.inkMuted;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityLabel={rotulo}
            accessibilityState={{ selected: ativa }}
            onPress={() => !ativa && router.replace(destino)}
            style={e.tab}
          >
            <View style={[e.pilulaTab, ativa && { backgroundColor: COR.primary50 }]}>
              <Icone size={26} color={cor} strokeWidth={ativa ? 2.75 : 2.25} />
            </View>
            <Text style={[e.textoTab, { color: cor }, ativa && { fontFamily: FONTE.extra }]}>{rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Peças do redesenho de 2026-11-14 (inspiração: apps de hábito como o Duolingo) ---

/** Barra de progresso grossa no topo dos fluxos (onboarding, cadastro, questionário). */
export function BarraDeProgresso({ atual, total, aoFechar }: { atual: number; total: number; aoFechar?: () => void }) {
  const fracao = Math.max(0, Math.min(1, atual / total));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
      {aoFechar ? (
        <Pressable accessibilityRole="button" accessibilityLabel="voltar" onPress={aoFechar} hitSlop={12}>
          <X size={28} color={COR.inkMuted} strokeWidth={2.75} />
        </Pressable>
      ) : null}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: atual }}
        style={{ flex: 1, height: 16, borderRadius: 999, backgroundColor: COR.linha, overflow: "hidden" }}
      >
        <View style={{ width: `${fracao * 100}%`, height: "100%", borderRadius: 999, backgroundColor: COR.action }}>
          <View
            style={{ height: 5, marginHorizontal: 8, marginTop: 3, borderRadius: 999, backgroundColor: "#ffffff55" }}
          />
        </View>
      </View>
    </View>
  );
}

const TOM: Record<
  "azul" | "verde" | "amarelo" | "cinza" | "vermelho",
  { fundo: string; texto: string; ponto: string }
> = {
  azul: { fundo: COR.primary50, texto: COR.actionPressed, ponto: COR.action },
  verde: { fundo: COR.successBg, texto: COR.successInk, ponto: COR.verde },
  amarelo: { fundo: COR.warningBg, texto: COR.warningInk, ponto: COR.amarelo },
  cinza: { fundo: COR.surfaceMuted, texto: COR.inkMuted, ponto: "#9aa3a5" },
  vermelho: { fundo: COR.dangerBg, texto: COR.dangerInk, ponto: COR.dangerInk },
};

/** Selo da situação: só o texto, na cor do tom (a cor nunca é o único sinal). */
export function Selo({ texto, tom }: { texto: string; tom: keyof typeof TOM }) {
  const t = TOM[tom];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: t.fundo,
      }}
    >
      <Text style={{ fontFamily: FONTE.bold, fontSize: 14, lineHeight: 18, color: t.texto }}>{texto}</Text>
    </View>
  );
}

export type Tom = keyof typeof TOM;
export const corDoTom = (tom: Tom) => TOM[tom];

/** Bloco de data à esquerda dos cartões de lista (como o pedido no iFood): bate o olho e vê o dia. */
export function BlocoData({ topo, dia, mes, tom = "azul" }: { topo: string; dia: string; mes: string; tom?: Tom }) {
  const t = TOM[tom];
  const hoje = topo === "hoje";
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 68,
        paddingVertical: 8,
        borderRadius: 16,
        alignItems: "center",
        backgroundColor: hoje ? t.ponto : t.fundo,
      }}
    >
      <Text style={{ fontFamily: FONTE.extra, fontSize: 14, lineHeight: 18, color: hoje ? "#ffffff" : t.texto }}>
        {topo}
      </Text>
      <Text style={{ fontFamily: FONTE.extra, fontSize: 30, lineHeight: 34, color: hoje ? "#ffffff" : COR.ink }}>
        {dia}
      </Text>
      <Text style={{ fontFamily: FONTE.bold, fontSize: 14, lineHeight: 18, color: hoje ? "#ffffff" : t.texto }}>
        {mes}
      </Text>
    </View>
  );
}

/** Ícone num quadrado colorido, à esquerda das linhas de lista (unidade, serviço). */
export function Avatar({ Icone, tom = "azul" }: { Icone: LucideIcon; tom?: Tom }) {
  const t = TOM[tom];
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.fundo,
      }}
    >
      <Icone size={28} color={t.ponto} strokeWidth={2.4} />
    </View>
  );
}

/**
 * Linha de lista tocável (como uma loja no iFood): algo à esquerda, o conteúdo e a seta. O que acontece
 * ao tocar vai para o leitor de tela; na tela, a seta basta.
 */
export function LinhaTocavel({
  esquerda,
  children,
  acao,
  onPress,
}: {
  esquerda: ReactNode;
  children: ReactNode;
  acao: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={acao}
      onPress={onPress}
      style={({ pressed }) => [
        e.card,
        { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 14 },
        pressed && { backgroundColor: COR.primary50, borderColor: COR.action },
      ]}
    >
      {esquerda}
      <View style={{ flex: 1, gap: 4 }}>{children}</View>
      <ChevronRight size={26} color={COR.inkMuted} strokeWidth={2.5} />
    </Pressable>
  );
}

/** Filtro em pílulas que rolam para o lado (as categorias do iFood). Uma escolhida por vez. */
export function Chips<T extends string>({
  opcoes,
  atual,
  mudar,
}: {
  opcoes: { id: T; rotulo: string }[];
  atual: T;
  mudar: (id: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -16, flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
    >
      {opcoes.map((o) => {
        const ativa = o.id === atual;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: ativa }}
            onPress={() => mudar(o.id)}
            style={{
              minHeight: 44,
              paddingHorizontal: 18,
              justifyContent: "center",
              borderRadius: 999,
              borderWidth: 2,
              borderBottomWidth: ativa ? 2 : 4,
              borderColor: ativa ? COR.action : COR.linha,
              backgroundColor: ativa ? COR.action : COR.surface,
            }}
          >
            <Text style={{ fontFamily: FONTE.extra, fontSize: 16, color: ativa ? "#ffffff" : COR.ink }}>
              {o.rotulo}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const ETAPAS = ["inscrição", "fila", "unidade", "sala"];

/**
 * A trilha do atendimento: inscrição → fila → unidade → sala. As feitas ganham ✓, a atual fica
 * em destaque; assim a pessoa vê se já está na fila de verdade.
 */
export function Trilha({ etapa, pendente = false }: { etapa: number; pendente?: boolean }) {
  // `pendente`: a etapa atual ainda não começou (ex.: inscrito com a fila fechada) e fica cinza.
  const corAtual = pendente ? "#9aa3a5" : COR.action;
  return (
    <View
      accessibilityLabel={`etapa ${Math.min(etapa + 1, ETAPAS.length)} de ${ETAPAS.length}: ${ETAPAS[Math.min(etapa, 3)]}`}
      style={{ flexDirection: "row", alignItems: "flex-start" }}
    >
      {ETAPAS.map((nome, i) => {
        const feita = i < etapa;
        const atual = i === etapa;
        return (
          <View key={nome} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch", height: 34 }}>
              <View
                style={{
                  flex: 1,
                  height: 4,
                  backgroundColor:
                    i === 0 ? "transparent" : i < etapa || (i === etapa && !pendente) ? COR.action : COR.linha,
                }}
              />
              <View
                style={{
                  width: atual ? 34 : 28,
                  height: atual ? 34 : 28,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: feita ? COR.action : atual ? COR.surface : COR.linha,
                  borderWidth: atual ? 4 : 0,
                  borderColor: corAtual,
                  borderStyle: atual && pendente ? "dashed" : "solid",
                }}
              >
                {feita ? <Check size={16} color="#ffffff" strokeWidth={3.5} /> : null}
                {atual && !pendente ? (
                  <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: COR.action }} />
                ) : null}
              </View>
              <View
                style={{
                  flex: 1,
                  height: 4,
                  backgroundColor: i === ETAPAS.length - 1 ? "transparent" : i < etapa ? COR.action : COR.linha,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: atual ? FONTE.extra : FONTE.semi,
                fontSize: 14,
                color: atual ? corAtual : feita ? COR.ink : COR.inkMuted,
              }}
            >
              {nome}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export const e = StyleSheet.create({
  rodape: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 2,
    borderTopColor: COR.surfaceMuted,
    backgroundColor: COR.surface,
  },
  tela: { flex: 1 },
  topo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COR.surfaceMuted,
    minHeight: 56,
  },
  marca: { fontFamily: FONTE.extra, fontSize: 20, color: COR.ink, letterSpacing: -0.3 },
  scr: { flexGrow: 1, gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  h1: { fontFamily: FONTE.extra, fontSize: 28, lineHeight: 34, color: COR.ink },
  p: { fontFamily: FONTE.regular, fontSize: 18, lineHeight: 28, color: COR.ink },
  pm: { fontFamily: FONTE.regular, fontSize: 18, lineHeight: 28, color: COR.inkMuted },
  small: { fontFamily: FONTE.semi, fontSize: 15, lineHeight: 22, color: COR.inkMuted },
  prog: { fontFamily: FONTE.bold, fontSize: 15, color: COR.inkMuted },
  btn: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  textoBtn: { fontFamily: FONTE.extra, fontSize: 18, lineHeight: 24, letterSpacing: 0.2 },
  link: { minHeight: 44, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  textoLink: { fontFamily: FONTE.bold, fontSize: 18, lineHeight: 24, textDecorationLine: "underline" },
  rotulo: { fontFamily: FONTE.bold, fontSize: 16, color: COR.ink },
  campo: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COR.linha,
    backgroundColor: COR.campoFundo,
    paddingHorizontal: 16,
    fontFamily: FONTE.semi,
    fontSize: 20,
    color: COR.ink,
  },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COR.linha,
    backgroundColor: COR.surface,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COR.inkMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  textoOpt: { flex: 1, fontFamily: FONTE.bold, fontSize: 18, lineHeight: 24, color: COR.ink },
  faixa: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 16, borderRadius: 16 },
  acaoFaixa: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    marginTop: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: "#ffffff",
  },
  ft: { fontFamily: FONTE.extra, fontSize: 18, lineHeight: 26 },
  fs: { fontFamily: FONTE.semi, fontSize: 16, lineHeight: 24 },
  card: {
    gap: 4,
    padding: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COR.linha,
    backgroundColor: COR.surface,
  },
  pos: {
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: COR.primary50,
  },
  num: { fontFamily: FONTE.extra, fontSize: 64, lineHeight: 68, color: COR.primary500 },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COR.surfaceMuted,
  },
  abas: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COR.border, backgroundColor: COR.surface },
  tab: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 8 },
  pilulaTab: { paddingHorizontal: 20, paddingVertical: 4, borderRadius: 999 },
  textoTab: { fontFamily: FONTE.bold, fontSize: 13, lineHeight: 18 },
  cheia: { flex: 1, backgroundColor: COR.surface },
  gaveta: { gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
});
