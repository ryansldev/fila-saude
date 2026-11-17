import { BottomSheet, BottomSheetView } from "@expo/ui/community/bottom-sheet";
import { type AppSize, buttonStyle, COLOR, DISABLED_OPACITY, FONT, LINO_SVG, type Variant } from "@fila-saude/design";
import { router } from "expo-router";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleUserRound,
  Eye,
  EyeOff,
  House,
  Info,
  type LucideIcon,
  MapPin,
  TriangleAlert,
  X,
} from "lucide-react-native";
import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
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
import { longDay } from "@/lib/days";

// Tokens do design system "Fila Saúde" (artifact do app do paciente).
export { COLOR, FONT };

export function Logo({
  size = 28,
  color = COLOR.primary500,
  core = "#ffffff",
}: {
  size?: number;
  color?: string;
  core?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden>
      <Path
        fill={color}
        d="M5.127 23.609C6.564 36.242 20.52 48.093 29.33 54.212a4.673 4.673 0 0 0 5.34 0c8.81-6.119 22.767-17.97 24.203-30.603C60.863 6.099 38.967 3.972 32 13.977 25.033 3.972 3.137 6.1 5.127 23.61Z"
      />
      <Path
        fill={core}
        d="M28.704 21.09a2.583 2.583 0 0 1 2.583-2.584h2.583a2.583 2.583 0 0 1 2.583 2.583v20.665a2.583 2.583 0 0 1-2.583 2.583h-2.583a2.583 2.583 0 0 1-2.583-2.583V21.09Z"
      />
      <Path
        fill={core}
        d="M19.663 30.13a2.583 2.583 0 0 1 2.583-2.583H42.91a2.583 2.583 0 0 1 2.583 2.583v2.583a2.583 2.583 0 0 1-2.583 2.583H22.246a2.583 2.583 0 0 1-2.583-2.583V30.13Z"
      />
    </Svg>
  );
}

/**
 * O mascote só aparece sobre branco (o jaleco é transparente).
 * `frame`: o cantinho branco ao redor; desliga quando o fundo da tela já é branco (fala do Dr.).
 */
export function Mascot({ size = 200, frame = true }: { size?: number; frame?: boolean }) {
  const drawing = <SvgXml xml={LINO_SVG} width={size} height={size} accessibilityLabel="mascote do fila saúde" />;
  if (!frame) return drawing;
  return (
    <View style={{ alignSelf: "center", backgroundColor: COLOR.surface, padding: 8, borderRadius: 16 }}>{drawing}</View>
  );
}

/**
 * O Dr. Lino pequeno com a fala num balão suave (azul bem claro, sem borda, pontinha para ele): as
 * perguntas do cadastro e o "entrar". Ocupa pouco, para o teclado não cobrir o campo.
 */
export function LinoBubble({ text }: { text: string }) {
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`dr. lino: ${text}`}
      style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}
    >
      <View style={{ backgroundColor: COLOR.surface }}>
        <Mascot size={96} frame={false} />
      </View>
      <View style={{ flex: 1, marginBottom: 18 }}>
        <View
          style={{
            backgroundColor: "#eef5fa",
            borderRadius: 20,
            borderBottomLeftRadius: 6,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text style={{ fontFamily: FONT.extra, fontSize: 18, lineHeight: 25, color: COLOR.primary900 }}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

/** O sininho do topo: com o ponto amarelo, os avisos estão desligados. Tocar abre a tela dos avisos. */
export function BellButton({ off, onPress }: { off: boolean; onPress: () => void }) {
  return (
    <TappableArea
      label={off ? "avisos desligados. tocar para ver" : "avisos ligados. tocar para ver"}
      onPress={onPress}
      style={(pressed) => ({
        padding: 9,
        marginRight: -9,
        borderRadius: 999,
        backgroundColor: pressed ? COLOR.surfaceMuted : "transparent",
      })}
    >
      <Bell size={22} color={COLOR.ink} strokeWidth={2} />
      {off ? (
        <View
          style={{
            position: "absolute",
            top: 7,
            right: 8,
            width: 10,
            height: 10,
            borderRadius: 999,
            backgroundColor: COLOR.yellow,
            borderWidth: 2,
            borderColor: COLOR.surface,
          }}
        />
      ) : null}
    </TappableArea>
  );
}

const TopContext = createContext<ReactNode>(null);

/** O que fica à direita do topo em todas as telas (o sininho dos avisos): posto uma vez, na raiz do app. */
export const HeaderRight = TopContext.Provider;

/** Topo das telas: seta à esquerda quando dá para voltar; depois o logo e "fila saúde"; à direita, o sininho. */
export function Top({ back = false, onBack }: { back?: boolean; onBack?: (() => void) | undefined }) {
  const right = useContext(TopContext);
  const onPress = onBack ?? (back && router.canGoBack() ? () => router.back() : undefined);
  return (
    <View style={e.top}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="voltar"
          onPress={onPress}
          hitSlop={12}
          style={({ pressed }) => [{ padding: 4, marginLeft: -4, borderRadius: 999 }, pressed && { opacity: 0.5 }]}
        >
          <ChevronLeft size={32} color={COLOR.ink} strokeWidth={2.5} />
        </Pressable>
      ) : null}
      <Logo />
      <Text style={e.brand}>fila saúde</Text>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/**
 * Mensagem do Dr., como no protótipo (lesson-say): personagem à esquerda, balão na altura do peito,
 * pontinha apontando para ele. Tudo sobre branco por causa do jaleco.
 */
export function DoctorSpeech({ greeting, name, text }: { greeting: string; name?: string | undefined; text: string }) {
  const title = name ? `${greeting}, ${name}!` : `${greeting}!`;
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`dr.: ${title} ${text}`}
      style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 }}
    >
      <View style={{ width: 96, alignItems: "center" }}>
        <Mascot size={92} frame={false} />
      </View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
        <View
          pointerEvents="none"
          style={{
            width: 14,
            height: 14,
            marginRight: -8,
            backgroundColor: COLOR.surface,
            borderLeftWidth: 2,
            borderBottomWidth: 2,
            borderColor: COLOR.line,
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
            borderColor: COLOR.line,
            backgroundColor: COLOR.surface,
          }}
        >
          <Text style={{ fontFamily: FONT.extra, fontSize: 20, lineHeight: 26, color: COLOR.ink }}>{title}</Text>
          <Text style={{ fontFamily: FONT.semi, fontSize: 16, lineHeight: 24, color: COLOR.inkMuted }}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

export function Screen({
  children,
  top = true,
  back = true,
  footer,
  actions,
  progress,
  background = COLOR.surface,
  onBack,
  onClose,
}: {
  children: ReactNode;
  top?: boolean;
  back?: boolean;
  /** Fluxo de vários passos: "voltar" vai ao passo anterior em vez de sair (e perder o que foi digitado). */
  onBack?: () => void;
  /** O X da barra de progresso, quando ele sai do fluxo em vez de voltar um passo. */
  onClose?: () => void;
  footer?: ReactNode;
  /** Botões da tela, sempre fixos embaixo e alinhados (principal em cima, secundário embaixo). */
  actions?: ReactNode;
  /** Fluxos: barra de progresso no lugar do topo com a marca. */
  progress?: { current: number; total: number };
  background?: string;
}) {
  // Botão "voltar" do Android: com `onBack`, vai ao passo anterior em vez de sair da tela.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const hasOnBack = Boolean(onBack);
  useEffect(() => {
    if (!hasOnBack) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!onBackRef.current) return false;
      onBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, [hasOnBack]);
  // Android edge-to-edge não redimensiona a janela com o teclado: sem o "padding" ele cobre o rodapé.
  return (
    <SafeAreaView style={[e.screen, { backgroundColor: background }]} edges={["top", "bottom"]}>
      {progress ? (
        <ProgressBar
          current={progress.current}
          total={progress.total}
          onClose={onClose ?? onBack ?? (router.canGoBack() ? () => router.back() : undefined)}
        />
      ) : top ? (
        <Top back={back} onBack={onBack} />
      ) : null}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={e.scr} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          {children}
        </ScrollView>
        {actions ? <View style={e.footer}>{actions}</View> : null}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Enquanto busca: logo e roda girando, para não parecer tela travada. */
export function Loading({ text, full = false }: { text?: string; full?: boolean }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={text ?? "carregando"}
      style={[{ alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 32 }, full && e.full]}
    >
      {full ? <Logo size={64} /> : null}
      <ActivityIndicator size="large" color={COLOR.action} />
      {text ? <Text style={[e.pm, { textAlign: "center" }]}>{text}</Text> : null}
    </View>
  );
}

/** Gaveta nativa que sobe de baixo (confirmações, escolhas): o gesto que o paciente já conhece do celular. */
export function Sheet({
  open,
  close,
  locked = false,
  children,
}: {
  open: boolean;
  close: () => void;
  /** Enquanto algo está sendo enviado, o gesto de puxar para baixo não fecha. */
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <BottomSheet
      index={open ? 0 : -1}
      enablePanDownToClose={!locked}
      onClose={close}
      backgroundStyle={{ backgroundColor: COLOR.surface }}
    >
      <BottomSheetView style={e.sheet}>{children}</BottomSheetView>
    </BottomSheet>
  );
}

export const Space = () => <View style={{ flex: 1, minHeight: 8 }} />;

export function Title({ children, style }: { children: ReactNode; style?: TextStyle }) {
  return (
    <Text accessibilityRole="header" style={[e.h1, style]}>
      {children}
    </Text>
  );
}
export const BodyText = ({ children, style }: { children: ReactNode; style?: TextStyle }) => (
  <Text style={[e.p, style]}>{children}</Text>
);
export const SoftText = ({ children, style }: { children: ReactNode; style?: TextStyle }) => (
  <Text style={[e.pm, style]}>{children}</Text>
);
export const Small = ({ children, style }: { children: ReactNode; style?: TextStyle }) => (
  <Text style={[e.small, style]}>{children}</Text>
);
export const Progress = ({ children }: { children: ReactNode }) => <Text style={e.prog}>{children}</Text>;

/**
 * O botão do design system (Duolingo): um componente para todas as ações do app. Cores e medidas
 * vêm de `@fila-saude/design`, as mesmas do `Button` do painel. A borda de baixo, mais escura,
 * "afunda" ao tocar. Variações: principal (uma por área), secundario, sucesso, perigo (só
 * emergência), perigoContorno (recusar, sair), texto e textoPerigo (baixo peso), branco.
 */
export function Button({
  text,
  onPress,
  variant = "primary",
  size = "default",
  icon: Icon,
  loading = false,
  disabled = false,
}: {
  text: string;
  onPress: () => void;
  variant?: Variant;
  size?: AppSize;
  icon?: LucideIcon | undefined;
  loading?: boolean;
  disabled?: boolean;
}) {
  const c = buttonStyle("app", variant, size);
  const blocked = disabled || loading;
  const plan = c.relief === 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: c.height,
          borderRadius: c.radius,
          borderWidth: plan ? 0 : 2,
          paddingHorizontal: c.paddingX,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.background,
          borderColor: c.border,
          borderBottomColor: c.shadow,
          borderBottomWidth: plan ? 0 : disabled ? 2 : pressed ? c.pressedRelief : c.relief,
          marginTop: pressed && !plan && !disabled ? c.pressDepth : 0,
          opacity: disabled ? DISABLED_OPACITY : plan && pressed ? 0.6 : 1,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, maxWidth: "100%" }}>
        {loading ? (
          <ActivityIndicator color={c.text} />
        ) : Icon ? (
          <Icon size={c.fontSize + 4} color={c.text} strokeWidth={2.5} />
        ) : null}
        <Text
          numberOfLines={plan ? 2 : 1}
          ellipsizeMode="tail"
          style={{
            flexShrink: 1,
            textAlign: "center",
            fontFamily: c.fontWeight === 800 ? FONT.extra : FONT.bold,
            fontSize: c.fontSize,
            lineHeight: c.fontSize + 6,
            letterSpacing: 0.2,
            color: c.text,
            textDecorationLine: plan ? "underline" : "none",
          }}
        >
          {loading ? "aguarde…" : text}
        </Text>
      </View>
    </Pressable>
  );
}

/** Botão de ligar (192, 188): um `Botao` que abre o discador. */
export const CallButton = ({
  text,
  number,
  variant = "primary",
}: {
  text: string;
  number: string;
  variant?: Variant;
}) => <Button text={text} variant={variant} onPress={() => void Linking.openURL(`tel:${number}`)} />;

/**
 * Área tocável do kit, para o que não tem cara de botão (cartão que abre a fila, linha de menu,
 * cartão de município). A aparência vem de quem usa: `style` e `children` podem depender de `pressed`.
 */
export function TappableArea({
  label,
  hint,
  onPress,
  role = "button",
  busy = false,
  disabled = false,
  selected,
  style,
  children,
}: {
  label: string;
  hint?: string | undefined;
  onPress: () => void;
  role?: "button" | "link";
  busy?: boolean;
  disabled?: boolean;
  selected?: boolean | undefined;
  style?: ViewStyle | ((pressed: boolean) => ViewStyle) | undefined;
  children: ReactNode | ((pressed: boolean) => ReactNode);
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{
        busy: busy,
        disabled: disabled,
        ...(selected === undefined ? {} : { selected: selected }),
      }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => (typeof style === "function" ? style(pressed) : style)}
    >
      {({ pressed }) => (typeof children === "function" ? children(pressed) : children)}
    </Pressable>
  );
}

/** Abas lado a lado, como o seletor do Duolingo: a escolhida fica cheia, com relevo. */
export function Segmented<T extends string>({
  options,
  current,
  change,
}: {
  options: { id: T; label: string }[];
  current: T;
  change: (id: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: "row", gap: 6, padding: 4, borderRadius: 16, backgroundColor: COLOR.surfaceMuted }}
    >
      {options.map((o) => {
        const active = current === o.id;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => change(o.id)}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
              backgroundColor: active ? COLOR.surface : "transparent",
              borderWidth: active ? 2 : 0,
              borderBottomWidth: active ? 4 : 0,
              borderColor: COLOR.line,
            }}
          >
            <Text style={{ fontFamily: FONT.extra, fontSize: 17, color: active ? COLOR.action : COLOR.inkMuted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  error,
  right,
  hint,
  ...props
}: { label: string; error?: string | undefined; right?: ReactNode; hint?: string | undefined } & TextInputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={e.label}>{label}</Text>
      <View style={{ justifyContent: "center" }}>
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholderTextColor="#9aa3a5"
          style={[
            e.field,
            right ? { paddingRight: 56 } : null,
            focus && { borderColor: COLOR.action, backgroundColor: COLOR.surface },
            error ? { borderColor: COLOR.dangerInk, backgroundColor: COLOR.dangerBg } : null,
          ]}
          {...props}
          onFocus={(ev) => {
            setFocus(true);
            props.onFocus?.(ev);
          }}
          onBlur={(ev) => {
            setFocus(false);
            props.onBlur?.(ev);
          }}
        />
        {right ? <View style={{ position: "absolute", right: 6 }}>{right}</View> : null}
      </View>
      {hint && !error ? (
        <Text style={{ fontFamily: FONT.semi, fontSize: 15, lineHeight: 21, color: COLOR.inkMuted }}>{hint}</Text>
      ) : null}
      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <CircleAlert size={18} color={COLOR.dangerInk} strokeWidth={2.4} />
          <Text style={{ flex: 1, fontFamily: FONT.bold, fontSize: 16, color: COLOR.dangerInk }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Senha com o olho dentro do campo: digitar no celular sem ver o que digitou trava muita gente. */
export function PasswordField({
  label,
  error,
  ...props
}: { label: string; error?: string | undefined } & TextInputProps) {
  const [see, setSee] = useState(false);
  const EyeIcon = see ? EyeOff : Eye;
  return (
    <Field
      label={label}
      error={error}
      secureTextEntry={!see}
      autoCapitalize="none"
      autoCorrect={false}
      right={
        <TappableArea
          label={see ? "esconder a senha" : "mostrar a senha"}
          onPress={() => setSee(!see)}
          style={(pressed) => ({
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <EyeIcon size={24} color={COLOR.action} strokeWidth={2.4} />
        </TappableArea>
      }
      {...props}
    />
  );
}

/** Opção do questionário: quadrado = várias; redondo = uma só. */
export function Option({
  text,
  checked,
  onPress,
  single = false,
}: {
  text: string;
  checked: boolean;
  onPress: () => void;
  single?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={single ? "radio" : "checkbox"}
      accessibilityState={{ checked: checked }}
      onPress={onPress}
      style={[e.opt, checked && { borderColor: COLOR.action, backgroundColor: COLOR.primary50 }]}
    >
      <View
        style={[
          e.box,
          single && { borderRadius: 999 },
          checked && { backgroundColor: COLOR.action, borderColor: COLOR.action },
        ]}
      >
        {checked ? <Check size={18} color="#ffffff" strokeWidth={3.5} /> : null}
      </View>
      <Text style={e.textOpt}>{text}</Text>
    </Pressable>
  );
}

type BannerKind = "notice" | "info" | "danger" | "ok";
const BANNER: Record<BannerKind, { background: string; color: string; Icon: LucideIcon }> = {
  notice: { background: COLOR.warningBg, color: COLOR.warningInk, Icon: TriangleAlert },
  info: { background: COLOR.primary50, color: COLOR.actionPressed, Icon: Info },
  danger: { background: COLOR.dangerBg, color: COLOR.dangerInk, Icon: CircleAlert },
  ok: { background: COLOR.successBg, color: COLOR.successInk, Icon: CircleCheck },
};

/** Faixa de aviso do design: ícone, título forte, texto e, quando há o que fazer, um botão. */
export function Banner({
  kind,
  title,
  text,
  large = false,
  action,
  style,
}: {
  kind: BannerKind;
  title: string;
  text?: string | undefined;
  large?: boolean;
  action?: { text: string; onPress: () => void; loading?: boolean } | undefined;
  style?: ViewStyle;
}) {
  const { background, color, Icon } = BANNER[kind];
  return (
    <View
      accessibilityRole={kind === "danger" || kind === "notice" ? "alert" : "summary"}
      style={[e.banner, { backgroundColor: background }, large && { paddingVertical: 20 }, style]}
    >
      <Icon size={large ? 30 : 26} color={color} strokeWidth={2.5} style={{ marginTop: large ? 0 : 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[e.ft, { color: color }, large && { fontSize: 24, lineHeight: 30 }]}>{title}</Text>
        {text ? <Text style={[e.fs, { color: color }]}>{text}</Text> : null}
        {action ? (
          <View style={{ marginTop: 10, alignSelf: "flex-start" }}>
            <Button
              text={action.text}
              onPress={action.onPress}
              variant="secondary"
              size="medium"
              loading={action.loading ?? false}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[e.card, style]}>{children}</View>;
}

/** Cartão inteiro tocável, com a seta e o que acontece ao tocar: na lista, cada item não vira um botão azul. */
export function TappableCard({
  children,
  action,
  onPress,
}: {
  children: ReactNode;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={action}
      onPress={onPress}
      style={({ pressed }) => [
        e.card,
        { flexDirection: "row", alignItems: "center", gap: 12 },
        pressed && { backgroundColor: COLOR.primary50, borderColor: COLOR.action },
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        {children}
        <Text style={{ fontFamily: FONT.extra, fontSize: 18, lineHeight: 24, color: COLOR.action, marginTop: 4 }}>
          {action}
        </Text>
      </View>
      <ChevronRight size={28} color={COLOR.action} strokeWidth={2.5} />
    </Pressable>
  );
}

/** Cartão da posição: o maior texto da tela. */
export function PositionCard({ context, position, detail }: { context: string; position: number; detail?: string }) {
  return (
    <View style={e.after} accessibilityLabel={`você é o ${position}º da fila`}>
      <Small>{context}</Small>
      <Text style={e.num}>{position}º</Text>
      <Text style={[e.p, { fontFamily: FONT.bold }]}>da fila</Text>
      {detail ? <Small>{detail}</Small> : null}
    </View>
  );
}

/** Abas de baixo: minha fila e unidades. */
export type AppTab = "today" | "appointments" | "units" | "account";

const TABS: {
  id: AppTab;
  label: string;
  destination: "/inicio" | "/atendimentos" | "/unidades" | "/conta";
  Icon: LucideIcon;
}[] = [
  { id: "today", label: "hoje", destination: "/inicio", Icon: House },
  { id: "appointments", label: "atendimentos", destination: "/atendimentos", Icon: CalendarDays },
  { id: "units", label: "unidades", destination: "/unidades", Icon: MapPin },
  { id: "account", label: "conta", destination: "/conta", Icon: CircleUserRound },
];

/** Abas de baixo, como em apps de governo e no Duolingo: ícone grande, rótulo curto, a atual em destaque. */
export function Tabs({ current, count = {} }: { current: AppTab; count?: Partial<Record<AppTab, number>> }) {
  return (
    <View style={e.tabs} accessibilityRole="tablist">
      {TABS.map(({ id, label, destination, Icon }) => {
        const active = current === id;
        const color = active ? COLOR.action : COLOR.inkMuted;
        return (
          <Pressable
            key={id}
            accessibilityRole="tab"
            accessibilityLabel={count[id] ? `${label}, ${count[id]}` : label}
            accessibilityState={{ selected: active }}
            onPress={() => !active && router.replace(destination)}
            style={e.tab}
          >
            <View style={[e.pillTab, active && { backgroundColor: COLOR.primary50 }]}>
              <Icon size={26} color={color} strokeWidth={active ? 2.75 : 2.25} />
              {count[id] ? (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: 4,
                    minWidth: 20,
                    paddingHorizontal: 5,
                    borderRadius: 999,
                    backgroundColor: COLOR.action,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontFamily: FONT.extra, fontSize: 12, lineHeight: 18, color: "#ffffff" }}>
                    {count[id]}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[e.textTab, { color: color }, active && { fontFamily: FONT.extra }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Peças do redesenho de 2026-11-14 (inspiração: apps de hábito como o Duolingo) ---

/** Barra de progresso grossa no topo dos fluxos (onboarding, cadastro, questionário). */
export function ProgressBar({ current, total, onClose }: { current: number; total: number; onClose?: () => void }) {
  const fraction = Math.max(0, Math.min(1, current / total));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8 }}>
      {onClose ? (
        <Pressable accessibilityRole="button" accessibilityLabel="voltar" onPress={onClose} hitSlop={12}>
          <X size={28} color={COLOR.inkMuted} strokeWidth={2.75} />
        </Pressable>
      ) : null}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: current }}
        style={{ flex: 1, height: 16, borderRadius: 999, backgroundColor: COLOR.line, overflow: "hidden" }}
      >
        <View style={{ width: `${fraction * 100}%`, height: "100%", borderRadius: 999, backgroundColor: COLOR.action }}>
          <View
            style={{ height: 5, marginHorizontal: 8, marginTop: 3, borderRadius: 999, backgroundColor: "#ffffff55" }}
          />
        </View>
      </View>
    </View>
  );
}

const TONE: Record<"blue" | "green" | "yellow" | "gray" | "red", { background: string; text: string; point: string }> =
  {
    blue: { background: COLOR.primary50, text: COLOR.actionPressed, point: COLOR.action },
    green: { background: COLOR.successBg, text: COLOR.successInk, point: COLOR.green },
    yellow: { background: COLOR.warningBg, text: COLOR.warningInk, point: COLOR.yellow },
    gray: { background: COLOR.surfaceMuted, text: COLOR.inkMuted, point: "#9aa3a5" },
    red: { background: COLOR.dangerBg, text: COLOR.dangerInk, point: COLOR.dangerInk },
  };

/** Selo da situação: só o texto, na cor do tom (a cor nunca é o único sinal). */
export function Badge({ text, tone }: { text: string; tone: keyof typeof TONE }) {
  const t = TONE[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        backgroundColor: t.background,
      }}
    >
      <Text style={{ fontFamily: FONT.bold, fontSize: 14, lineHeight: 18, color: t.text }}>{text}</Text>
    </View>
  );
}

export type Tone = keyof typeof TONE;
export const toneColor = (tone: Tone) => TONE[tone];

/** Bloco de data à esquerda dos cartões de lista (como o pedido no iFood): bate o olho e vê o dia. */
export function DateBlock({
  top,
  day,
  month,
  tone = "blue",
}: {
  top: string;
  day: string;
  month: string;
  tone?: Tone;
}) {
  const t = TONE[tone];
  const today = top === "today";
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 68,
        paddingVertical: 8,
        borderRadius: 16,
        alignItems: "center",
        backgroundColor: today ? t.point : t.background,
      }}
    >
      <Text style={{ fontFamily: FONT.extra, fontSize: 14, lineHeight: 18, color: today ? "#ffffff" : t.text }}>
        {top}
      </Text>
      <Text style={{ fontFamily: FONT.extra, fontSize: 30, lineHeight: 34, color: today ? "#ffffff" : COLOR.ink }}>
        {day}
      </Text>
      <Text style={{ fontFamily: FONT.bold, fontSize: 14, lineHeight: 18, color: today ? "#ffffff" : t.text }}>
        {month}
      </Text>
    </View>
  );
}

/** Ícone num quadrado colorido, à esquerda das linhas de lista (unidade, serviço). */
export function Avatar({ Icon, tone = "blue" }: { Icon: LucideIcon; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.background,
      }}
    >
      <Icon size={28} color={t.point} strokeWidth={2.4} />
    </View>
  );
}

/**
 * Linha de lista tocável (como uma loja no iFood): algo à esquerda, o conteúdo e a seta. O que acontece
 * ao tocar vai para o leitor de tela; na tela, a seta basta.
 */
export function TappableRow({
  left,
  children,
  action,
  onPress,
}: {
  left: ReactNode;
  children: ReactNode;
  action: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={action}
      onPress={onPress}
      style={({ pressed }) => [
        e.card,
        { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 14 },
        pressed && { backgroundColor: COLOR.primary50, borderColor: COLOR.action },
      ]}
    >
      {left}
      <View style={{ flex: 1, gap: 4 }}>{children}</View>
      <ChevronRight size={26} color={COLOR.inkMuted} strokeWidth={2.5} />
    </Pressable>
  );
}

/** Pílula com ícone (vagas, inscrito, horário): a cor nunca é o único sinal, o texto vem junto. */
export function Pill({ text, tone = "gray", Icon }: { text: string; tone?: Tone; Icon?: LucideIcon }) {
  const t = TONE[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: t.background,
      }}
    >
      {Icon ? <Icon size={15} color={t.text} strokeWidth={2.5} /> : null}
      <Text style={{ fontFamily: FONT.extra, fontSize: 14, lineHeight: 18, color: t.text }}>{text}</Text>
    </View>
  );
}

const DAY_WIDTH = 64;
const DAY_GAP = 8;

/**
 * A faixa de dias da unidade: só os dias com atendimento, todos do mesmo tamanho, que rolam para o lado.
 * Embaixo do título, o mês e o ano do primeiro dia visível; no fim, o botão do calendário (com mais de
 * um dia).
 */
export function DayStrip({
  days,
  current,
  change,
  onOpenCalendar,
}: {
  days: { key: string; top: string; day: string; monthYear: string }[];
  current: string | null;
  change: (key: string) => void;
  onOpenCalendar: () => void;
}) {
  const [first, setFirst] = useState(0);
  const monthYear = days[Math.min(first, days.length - 1)]?.monthYear ?? "";
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: FONT.extra, fontSize: 16, lineHeight: 20, color: COLOR.action, marginTop: -8 }}>
        {monthYear}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -16, flexGrow: 0 }}
        contentContainerStyle={{ gap: DAY_GAP, paddingHorizontal: 16 }}
        scrollEventThrottle={64}
        onScroll={(ev) => setFirst(Math.max(0, Math.round(ev.nativeEvent.contentOffset.x / (DAY_WIDTH + DAY_GAP))))}
      >
        {days.map((d) => {
          const chosen = d.key === current;
          return (
            <TappableArea
              key={d.key}
              label={`${d.top}, ${d.day}`}
              selected={chosen}
              onPress={() => change(d.key)}
              style={(pressed) => ({
                width: DAY_WIDTH,
                paddingVertical: 8,
                alignItems: "center",
                borderRadius: 16,
                borderWidth: 2,
                borderBottomWidth: chosen || pressed ? 2 : 4,
                marginTop: !chosen && pressed ? 2 : 0,
                borderColor: chosen ? COLOR.action : COLOR.line,
                borderBottomColor: chosen ? COLOR.actionShadow : COLOR.line,
                backgroundColor: chosen ? COLOR.action : COLOR.surface,
              })}
            >
              <Text
                style={{
                  fontFamily: FONT.extra,
                  fontSize: 13,
                  lineHeight: 17,
                  color: chosen ? "#cfe2f6" : COLOR.inkMuted,
                }}
              >
                {d.top}
              </Text>
              <Text
                style={{
                  fontFamily: FONT.extra,
                  fontSize: 24,
                  lineHeight: 30,
                  color: chosen ? "#ffffff" : COLOR.ink,
                }}
              >
                {d.day}
              </Text>
            </TappableArea>
          );
        })}
        {days.length > 1 ? (
          <TappableArea
            label="abrir o calendário"
            onPress={onOpenCalendar}
            style={(pressed) => ({
              width: DAY_WIDTH,
              paddingVertical: 8,
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              borderRadius: 16,
              borderWidth: 2,
              borderBottomWidth: pressed ? 2 : 4,
              marginTop: pressed ? 2 : 0,
              borderColor: "#cfe2f6",
              backgroundColor: COLOR.surface,
            })}
          >
            <CalendarDays size={22} color={COLOR.action} strokeWidth={2.4} />
            <Text style={{ fontFamily: FONT.extra, fontSize: 11, lineHeight: 14, color: COLOR.action }}>
              calendário
            </Text>
          </TappableArea>
        ) : null}
      </ScrollView>
    </View>
  );
}

const SHORT_WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Seta do calendário: um quadrado com contorno, como o botão secundário. */
function MonthArrow({
  label,
  Icon,
  onPress,
  disabled,
}: {
  label: string;
  Icon: LucideIcon;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <TappableArea
      label={label}
      onPress={onPress}
      disabled={disabled}
      style={(pressed) => ({
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 14,
        borderWidth: 2,
        borderBottomWidth: pressed ? 2 : 4,
        borderColor: COLOR.line,
        backgroundColor: COLOR.surface,
        opacity: disabled ? DISABLED_OPACITY : 1,
      })}
    >
      <Icon size={22} color={COLOR.action} strokeWidth={2.6} />
    </TappableArea>
  );
}

/**
 * O mês numa gaveta: os dias com atendimento azuis e tocáveis, os outros apagados, hoje com contorno
 * tracejado; o botão confirma o dia escolhido.
 */
export function MonthCalendar({
  open,
  close,
  months,
  current,
  onChoose,
}: {
  open: boolean;
  close: () => void;
  /** Os meses com atendimento, em ordem: `title` ("novembro de 2026") e a grade de `monthGrid`. */
  months: {
    title: string;
    weeks: ({ key: string; day: number; has: boolean; today: boolean } | null)[][];
  }[];
  current: string | null;
  onChoose: (key: string) => void;
}) {
  const [choice, setChoice] = useState(current);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!open) return;
    setChoice(current);
    const i = months.findIndex((m) => m.weeks.flat().some((c) => c?.key === current));
    setIndex(Math.max(0, i));
  }, [open, current, months]);
  const month = months[index];
  return (
    <Sheet open={open} close={close}>
      {month ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontFamily: FONT.extra, fontSize: 20, lineHeight: 26, color: COLOR.ink }}>
              {month.title}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <MonthArrow
                label="mês anterior"
                Icon={ChevronLeft}
                disabled={index === 0}
                onPress={() => setIndex(index - 1)}
              />
              <MonthArrow
                label="próximo mês"
                Icon={ChevronRight}
                disabled={index >= months.length - 1}
                onPress={() => setIndex(index + 1)}
              />
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row" }}>
              {SHORT_WEEK.map((d) => (
                <Text
                  key={d}
                  style={{ flex: 1, textAlign: "center", fontFamily: FONT.extra, fontSize: 13, color: "#8a9496" }}
                >
                  {d.charAt(0)}
                </Text>
              ))}
            </View>
            {month.weeks.map((week, s) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a semana é a posição na grade do mês.
              <View key={s} style={{ flexDirection: "row", gap: 4 }}>
                {week.map((c, i) => {
                  // biome-ignore lint/suspicious/noArrayIndexKey: dia vazio antes ou depois do mês.
                  if (!c) return <View key={`v${i}`} style={{ flex: 1, height: 44 }} />;
                  const checked = c.key === choice;
                  const box: ViewStyle = {
                    flex: 1,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 12,
                    ...(c.today ? { borderWidth: 2, borderStyle: "dashed", borderColor: "#9cc4ea" } : {}),
                  };
                  const number = (color: string) => (
                    <Text style={{ fontFamily: FONT.extra, fontSize: 16, color: color }}>{c.day}</Text>
                  );
                  if (!c.has)
                    return (
                      <View key={c.key} style={box}>
                        {number("#b9c2c4")}
                      </View>
                    );
                  return (
                    <TappableArea
                      key={c.key}
                      label={`dia ${c.day}, tem atendimento`}
                      selected={checked}
                      onPress={() => setChoice(c.key)}
                      style={{
                        ...box,
                        borderWidth: 2,
                        borderStyle: "solid",
                        borderBottomWidth: 3,
                        borderColor: checked ? COLOR.actionShadow : "#cfe2f6",
                        backgroundColor: checked ? COLOR.action : COLOR.primary50,
                      }}
                    >
                      {number(checked ? "#ffffff" : COLOR.ink)}
                    </TappableArea>
                  );
                })}
              </View>
            ))}
          </View>
          <Button
            text={choice ? `ver ${longDay(choice)}` : "escolha um dia"}
            disabled={!choice}
            onPress={() => {
              if (!choice) return;
              onChoose(choice);
              close();
            }}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const STAGES = ["inscrição", "fila", "unidade", "sala"];

/**
 * A trilha do atendimento: inscrição → fila → unidade → sala. As feitas ganham ✓, a atual fica
 * em destaque; assim a pessoa vê se já está na fila de verdade.
 */
export function Track({ stage, pending = false }: { stage: number; pending?: boolean }) {
  // `pendente`: a etapa atual ainda não começou (ex.: inscrito com a fila fechada) e fica cinza.
  const currentColor = pending ? "#9aa3a5" : COLOR.action;
  return (
    <View
      accessibilityLabel={`etapa ${Math.min(stage + 1, STAGES.length)} de ${STAGES.length}: ${STAGES[Math.min(stage, 3)]}`}
      style={{ flexDirection: "row", alignItems: "flex-start" }}
    >
      {STAGES.map((name, i) => {
        const done = i < stage;
        const current = i === stage;
        return (
          <View key={name} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch", height: 34 }}>
              <View
                style={{
                  flex: 1,
                  height: 4,
                  backgroundColor:
                    i === 0 ? "transparent" : i < stage || (i === stage && !pending) ? COLOR.action : COLOR.line,
                }}
              />
              <View
                style={{
                  width: current ? 34 : 28,
                  height: current ? 34 : 28,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: done ? COLOR.action : current ? COLOR.surface : COLOR.line,
                  borderWidth: current ? 4 : 0,
                  borderColor: currentColor,
                  borderStyle: current && pending ? "dashed" : "solid",
                }}
              >
                {done ? <Check size={16} color="#ffffff" strokeWidth={3.5} /> : null}
                {current && !pending ? (
                  <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: COLOR.action }} />
                ) : null}
              </View>
              <View
                style={{
                  flex: 1,
                  height: 4,
                  backgroundColor: i === STAGES.length - 1 ? "transparent" : i < stage ? COLOR.action : COLOR.line,
                }}
              />
            </View>
            <Text
              style={{
                fontFamily: current ? FONT.extra : FONT.semi,
                fontSize: 14,
                color: current ? currentColor : done ? COLOR.ink : COLOR.inkMuted,
              }}
            >
              {name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export const e = StyleSheet.create({
  footer: {
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 2,
    borderTopColor: COLOR.surfaceMuted,
    backgroundColor: COLOR.surface,
  },
  screen: { flex: 1 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.surfaceMuted,
    minHeight: 56,
  },
  brand: { fontFamily: FONT.extra, fontSize: 20, color: COLOR.ink, letterSpacing: -0.3 },
  scr: { flexGrow: 1, gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  h1: { fontFamily: FONT.extra, fontSize: 28, lineHeight: 34, color: COLOR.ink },
  p: { fontFamily: FONT.regular, fontSize: 18, lineHeight: 28, color: COLOR.ink },
  pm: { fontFamily: FONT.regular, fontSize: 18, lineHeight: 28, color: COLOR.inkMuted },
  small: { fontFamily: FONT.semi, fontSize: 15, lineHeight: 22, color: COLOR.inkMuted },
  prog: { fontFamily: FONT.bold, fontSize: 15, color: COLOR.inkMuted },
  label: { fontFamily: FONT.bold, fontSize: 16, color: COLOR.ink },
  field: {
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLOR.line,
    backgroundColor: COLOR.fieldBackground,
    paddingHorizontal: 16,
    fontFamily: FONT.semi,
    fontSize: 20,
    color: COLOR.ink,
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
    borderColor: COLOR.line,
    backgroundColor: COLOR.surface,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLOR.inkMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  textOpt: { flex: 1, fontFamily: FONT.bold, fontSize: 18, lineHeight: 24, color: COLOR.ink },
  banner: { flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 16, borderRadius: 16 },
  ft: { fontFamily: FONT.extra, fontSize: 18, lineHeight: 26 },
  fs: { fontFamily: FONT.semi, fontSize: 16, lineHeight: 24 },
  card: {
    gap: 4,
    padding: 18,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLOR.line,
    backgroundColor: COLOR.surface,
  },
  after: {
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 20,
    backgroundColor: COLOR.primary50,
  },
  num: { fontFamily: FONT.extra, fontSize: 64, lineHeight: 68, color: COLOR.primary500 },
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLOR.surfaceMuted,
  },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COLOR.border, backgroundColor: COLOR.surface },
  tab: { flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", gap: 2, paddingVertical: 8 },
  pillTab: { paddingHorizontal: 20, paddingVertical: 4, borderRadius: 999 },
  textTab: { fontFamily: FONT.bold, fontSize: 13, lineHeight: 18 },
  full: { flex: 1, backgroundColor: COLOR.surface },
  sheet: { gap: 16, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
});
