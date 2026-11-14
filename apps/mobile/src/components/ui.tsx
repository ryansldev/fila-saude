import { BottomSheet, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { router } from "expo-router";
import {
  Building2,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Info,
  ListOrdered,
  type LucideIcon,
  TriangleAlert,
} from "lucide-react-native";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
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

/** O mascote só aparece sobre branco (o jaleco é transparente). */
export function Mascote({ tamanho = 200 }: { tamanho?: number }) {
  return (
    <View style={{ alignSelf: "center", backgroundColor: COR.surface, padding: 8, borderRadius: 16 }}>
      <SvgXml xml={MASCOTE_SVG} width={tamanho} height={tamanho} accessibilityLabel="mascote do fila saúde" />
    </View>
  );
}

/** Topo das telas: logo, "fila saúde" e, quando há para onde voltar, "voltar". */
export function Topo({ voltar = false, aoVoltar }: { voltar?: boolean; aoVoltar?: (() => void) | undefined }) {
  return (
    <View style={e.topo}>
      <Logo />
      <Text style={e.marca}>fila saúde</Text>
      <View style={{ flex: 1 }} />
      {aoVoltar ? (
        <LinkBotao texto="voltar" onPress={aoVoltar} />
      ) : voltar && router.canGoBack() ? (
        <LinkBotao texto="voltar" onPress={() => router.back()} />
      ) : null}
    </View>
  );
}

export function Tela({
  children,
  topo = true,
  voltar = true,
  rodape,
  fundo = COR.surface,
  aoVoltar,
}: {
  children: ReactNode;
  topo?: boolean;
  voltar?: boolean;
  /** Fluxo de vários passos: "voltar" vai ao passo anterior em vez de sair (e perder o que foi digitado). */
  aoVoltar?: () => void;
  rodape?: ReactNode;
  fundo?: string;
}) {
  // Android edge-to-edge não redimensiona a janela com o teclado: sem o "padding" ele cobre o rodapé.
  return (
    <SafeAreaView style={[e.tela, { backgroundColor: fundo }]} edges={["top", "bottom"]}>
      {topo ? <Topo voltar={voltar} aoVoltar={aoVoltar} /> : null}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={e.scr} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
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
export function Gaveta({ aberta, fechar, children }: { aberta: boolean; fechar: () => void; children: ReactNode }) {
  return (
    <BottomSheet
      index={aberta ? 0 : -1}
      enablePanDownToClose
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

const ESTILO_BOTAO: Record<TipoBotao, { fundo: string; borda: string; texto: string }> = {
  primario: { fundo: COR.action, borda: COR.action, texto: "#ffffff" },
  secundario: { fundo: COR.surface, borda: COR.border, texto: COR.ink },
  perigo: { fundo: COR.surface, borda: COR.border, texto: COR.dangerInk },
  perigoCheio: { fundo: COR.dangerInk, borda: COR.dangerInk, texto: "#ffffff" },
  branco: { fundo: "#ffffff", borda: "#ffffff", texto: COR.primary900 },
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
          backgroundColor: pressed && tipo === "primario" ? COR.actionPressed : c.fundo,
          borderColor: pressed && tipo === "primario" ? COR.actionPressed : c.borda,
          opacity: desativado ? 0.5 : 1,
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
  return (
    <View style={{ gap: 6 }}>
      <Text style={e.rotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        accessibilityHint={erro}
        placeholderTextColor={COR.inkMuted}
        style={[e.campo, erro ? { borderColor: COR.dangerInk } : null]}
        {...props}
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
export function Abas({ atual }: { atual: "fila" | "unidades" }) {
  const aba = (id: "fila" | "unidades", rotulo: string, destino: "/inicio" | "/agenda", Icone: LucideIcon) => {
    const ativa = atual === id;
    const cor = ativa ? COR.action : COR.inkMuted;
    return (
      <Pressable
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
  };
  return (
    <View style={e.abas} accessibilityRole="tablist">
      {aba("fila", "minha fila", "/inicio", ListOrdered)}
      {aba("unidades", "unidades", "/agenda", Building2)}
    </View>
  );
}

export const e = StyleSheet.create({
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
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  textoBtn: { fontFamily: FONTE.extra, fontSize: 18, lineHeight: 24 },
  link: { minHeight: 44, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  textoLink: { fontFamily: FONTE.bold, fontSize: 18, lineHeight: 24, textDecorationLine: "underline" },
  rotulo: { fontFamily: FONTE.bold, fontSize: 16, color: COR.ink },
  campo: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COR.border,
    paddingHorizontal: 16,
    fontFamily: FONTE.semi,
    fontSize: 20,
    color: COR.ink,
  },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COR.border,
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
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COR.border,
    backgroundColor: COR.surface,
  },
  pos: {
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: COR.primary50,
    borderWidth: 1,
    borderColor: COR.border,
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
  textoTab: { fontFamily: FONTE.bold, fontSize: 16, lineHeight: 22 },
  cheia: { flex: 1, backgroundColor: COR.surface },
  gaveta: { gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
});
