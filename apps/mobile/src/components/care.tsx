import type { MyEntry } from "@fila-saude/schemas/queue";
import { router, useFocusEffect } from "expo-router";
import { ChevronRight, Ellipsis, Hourglass, QrCode } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Alert, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  type AppTab,
  Avatar,
  Badge,
  Banner,
  BellButton,
  Button,
  CallButton,
  Card,
  COLOR,
  DateBlock,
  FONT,
  Loading,
  Logo,
  Sheet,
  Small,
  SoftText,
  Tabs,
  TappableArea,
  Title,
  Track,
} from "@/components/ui";
import { properName } from "@/lib/account";
import { QUERY_INTERVAL_MS } from "@/lib/config";
import { dayParts, hour, isToday, shortDay } from "@/lib/dates";
import { useSession } from "@/lib/session";
import { canRedo, SIGN_UP_PATH } from "@/lib/sign-ups";
import {
  cancellationNotice,
  entrySituation,
  entrySummary,
  errorMessage,
  errorNotice,
  nextStep,
  type Situation,
  WORSENED_GUIDANCE,
} from "@/lib/texts";
import { rowFor, tabCount, ticketCardFor } from "@/lib/today";

// "hoje" só quando a sessão é hoje no fuso da unidade; senão, o dia.
export const when = (en: MyEntry) =>
  en.session ? (isToday(en.session.start, Date.now()) ? " · hoje" : ` · ${shortDay(en.session.start)}`) : "";
export const context = (en: MyEntry) =>
  `${en.unit} · ${en.service.toLowerCase()}${when(en)}${en.forMe ? "" : ` · para ${properName(en.person)}`}`;
export const missing = (position: number, minutes: number) =>
  minutes <= 0 || position <= 1 ? "você é o próximo" : `cerca de ${minutes} min para a sua vez`;

// "é a sua vez" dispensado não volta ao trocar de aba (a tela remonta); vale enquanto o app está aberto.
export const SEEN_TURNS = new Set<string>();

export const cancellationEffect = (sit: Situation) =>
  sit.kind === "reserve"
    ? "você sai da reserva."
    : sit.kind === "list"
      ? "você sai da lista de espera."
      : "você perde esta vaga.";

/** Confirmação do "não vou poder ir" (tela 10): diz o efeito antes; o botão de perigo é o principal. */
export function ConfirmCancellation({
  target,
  close,
  confirm,
}: {
  target: { en: MyEntry; sit: Situation; ctx: string } | null;
  close: () => void;
  confirm: (entryId: string) => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Enquanto envia, a gaveta não fecha (o pedido terminaria sem ninguém ver o resultado). Ao fechar, o
  // erro some: a próxima abertura começa limpa.
  const closeSheet = () => {
    if (sending) return;
    setError(null);
    close();
  };
  return (
    <Sheet open={target !== null} close={closeSheet} locked={sending}>
      {target ? (
        <>
          <Title>não vou poder ir?</Title>
          <Text style={{ fontFamily: FONT.extra, fontSize: 20, lineHeight: 28, color: COLOR.dangerInk }}>
            {cancellationEffect(target.sit)}
          </Text>
          <Small>{target.ctx}</Small>
          <SoftText>para outro dia, faça uma nova inscrição.</SoftText>
          {error ? <Banner kind="danger" title="não deu certo" text={error} /> : null}
          <Button
            text="não vou poder ir"
            variant="danger"
            loading={sending}
            onPress={async () => {
              setSending(true);
              setError(null);
              try {
                await confirm(target.en.entryId);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setSending(false);
              }
            }}
          />
          <Button text="voltar, eu vou" variant="secondary" onPress={closeSheet} disabled={sending} />
        </>
      ) : null}
    </Sheet>
  );
}

/** "é a sua vez!": tela cheia verde, como no design. */
export function YourTurn({ ticket, station, close }: { ticket: string; station: string | null; close: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.call }}>
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}
        accessibilityLiveRegion="assertive"
      >
        <Logo size={56} color="#ffffff" core={COLOR.call} />
        <Text style={{ fontFamily: FONT.extra, fontSize: 40, lineHeight: 44, color: "#ffffff" }}>é a sua vez!</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 18, color: "#ffffff" }}>senha</Text>
        <Text style={{ fontFamily: FONT.extra, fontSize: 88, lineHeight: 92, color: "#ffffff", letterSpacing: 2 }}>
          {ticket}
        </Text>
        <Text style={{ fontFamily: FONT.extra, fontSize: 28, lineHeight: 34, color: "#ffffff" }}>
          {station ? station.toLowerCase() : "veja a sala na TV"}
        </Text>
        <View style={{ alignSelf: "stretch", marginTop: 24 }}>
          <Button text="estou indo" variant="white" onPress={close} />
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Senha e posição, quando a pessoa já está na fila: o maior texto do cartão. */
function InQueue({ en, sit }: { en: MyEntry; sit: Situation }) {
  switch (sit.kind) {
    case "position":
      return <Position ticket={en.ticket} position={sit.position} detail={missing(sit.position, sit.minutes)} />;
    case "no_estimate":
      return <Position ticket={en.ticket} detail="sem previsão de tempo agora" />;
    case "come":
      return <Position ticket={en.ticket} detail="você é o próximo" />;
    case "reception":
      return <Position ticket={en.ticket} detail="mostre esta senha na recepção" />;
    default:
      return null;
  }
}

/** Senha e posição, o maior texto do cartão. */
export function Position({ ticket, position, detail }: { ticket: string | null; position?: number; detail: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 16,
        borderRadius: 18,
        backgroundColor: COLOR.primary50,
      }}
    >
      {position !== undefined ? (
        <View style={{ alignItems: "center", minWidth: 72 }}>
          <Text style={{ fontFamily: FONT.extra, fontSize: 48, lineHeight: 52, color: COLOR.action }}>{position}º</Text>
          <Small>da fila</Small>
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        {ticket ? (
          <Text style={{ fontFamily: FONT.extra, fontSize: 22, lineHeight: 28, color: COLOR.ink, letterSpacing: 1 }}>
            senha {ticket}
          </Text>
        ) : null}
        <Text style={{ fontFamily: FONT.bold, fontSize: 17, lineHeight: 24, color: COLOR.actionPressed }}>
          {detail}
        </Text>
      </View>
    </View>
  );
}

/**
 * Um atendimento (revisão de 2026-11-14): o que é, quando (dia e faixa de horário), onde, para quem,
 * a senha quando já está na fila, uma frase com o próximo passo e uma ação principal.
 */
export function CareCard({
  en,
  sit,
  leaving,
  onCancel,
  answer = null,
  redo = null,
  onOpen,
  variant = "highlight",
}: {
  en: MyEntry;
  sit: Situation;
  leaving: (() => void) | null;
  onCancel: (() => void) | null;
  /** RN-CONF-01: alocada, à espera da resposta; `null` enquanto envia ou fora disso. */
  answer?: ((r: "confirm" | "refuse") => void) | null;
  /** RN-RISCO-03 / I9: refazer o questionário enquanto está na lista. */
  redo?: (() => void) | null;
  /** Abre a tela da fila deste atendimento (senha grande e progresso). */
  onOpen?: () => void;
  /** "destaque": o de hoje, como o acompanhamento de um pedido; "lista": compacto, com o dia à esquerda. */
  variant?: "highlight" | "list";
}) {
  const now = Date.now();
  const r = entrySummary(en, sit, now);
  const [worsened, setWorsened] = useState(false);
  if (variant === "list") return <CardInList en={en} sit={sit} onCancel={onCancel} onOpen={onOpen} />;
  const canCheckIn = ["position", "come", "no_estimate"].includes(sit.kind) && en.itemState === "remote";
  const present = (sit.kind === "position" || sit.kind === "no_estimate") && sit.present;
  const showsTrack = r.stage !== null && r.stage < 4;
  return (
    <Card style={{ gap: 0, padding: 0 }}>
      <Tappable onOpen={onOpen} en={en} style={{ padding: 14 }}>
        <CareHeader en={en} sit={sit} onOpen={onOpen} />
      </Tappable>
      <View style={{ gap: 16, padding: 16, borderTopWidth: 2, borderTopColor: COLOR.surfaceMuted }}>
        <Text style={{ fontFamily: FONT.extra, fontSize: 19, lineHeight: 26, color: COLOR.ink }}>
          {nextStep(en, sit, now)}
        </Text>
        {showsTrack ? <Track stage={r.stage ?? 0} pending={!r.inQueue} /> : null}
        <InQueue en={en} sit={sit} />
        {sit.kind === "reception" ? (
          <Button text="ler o QR de novo" variant="secondary" onPress={() => router.push("/check-in")} />
        ) : null}
        {canCheckIn ? <Button text="cheguei na unidade" onPress={() => router.push("/check-in")} /> : null}
        {present ? (
          leaving ? (
            <Button text="vou sair um pouco" variant="secondary" onPress={leaving} />
          ) : (
            <Loading />
          )
        ) : null}
        {present && !worsened ? (
          <Button variant="dangerText" text="meus sintomas pioraram" onPress={() => setWorsened(true)} />
        ) : null}
        {present && worsened ? (
          <View style={{ gap: 10 }}>
            <Banner kind="danger" title="seus sintomas pioraram?" text={WORSENED_GUIDANCE} />
            <CallButton text="ligar para o SAMU (192)" number="192" variant="secondary" />
          </View>
        ) : null}
        {sit.kind === "allocated" ? (
          answer ? (
            <>
              <Button text="vou, confirmar" onPress={() => answer("confirm")} />
              <Button text="não posso nesta data" variant="secondary" onPress={() => answer("refuse")} />
            </>
          ) : (
            <Loading />
          )
        ) : null}
        {redo ? <Button variant="text" text="minha situação mudou: responder de novo" onPress={redo} /> : null}
        {onCancel ? (
          <Button
            variant="dangerText"
            text={sit.kind === "allocated" || sit.kind === "list" ? "sair da lista de espera" : "não vou poder ir"}
            onPress={onCancel}
          />
        ) : null}
      </View>
    </Card>
  );
}

/** A linha de cima de todo cartão de atendimento: o dia num bloco à esquerda, o que é, a hora, onde e a situação. */
/** Área que abre a tela da fila; sem `onOpen`, é só uma caixa. */
function Tappable({
  onOpen,
  en,
  style,
  children,
}: {
  onOpen: (() => void) | undefined;
  en: MyEntry;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  if (!onOpen) return <View style={style}>{children}</View>;
  return (
    <TappableArea
      label={`ver a fila de ${en.service.toLowerCase()}`}
      onPress={onOpen}
      style={(pressed) => ({ ...style, ...(pressed ? { opacity: 0.6 } : {}) })}
    >
      {children}
    </TappableArea>
  );
}

function CareHeader({ en, sit, onOpen }: { en: MyEntry; sit: Situation; onOpen?: (() => void) | undefined }) {
  const now = Date.now();
  const r = entrySummary(en, sit, now);
  const closed = r.group === "closed";
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      {en.session ? (
        <DateBlock {...dayParts(en.session.start, now)} tone={closed ? "gray" : r.tone} />
      ) : (
        <Avatar Icon={Hourglass} tone={r.tone} />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{ fontFamily: FONT.extra, fontSize: 20, lineHeight: 26, color: closed ? COLOR.inkMuted : COLOR.ink }}
        >
          {en.service.toLowerCase()}
        </Text>
        <Small>
          {en.session ? `${hour(en.session.start)} às ${hour(en.session.end)} · ` : ""}
          {en.unit}
          {en.forMe ? "" : ` · para ${properName(en.person)}`}
        </Small>
        <Badge text={r.badge} tone={r.tone} />
      </View>
      {onOpen ? <ChevronRight size={26} color={COLOR.inkMuted} strokeWidth={2.5} /> : null}
    </View>
  );
}

/** Versão compacta, para a lista de atendimentos: só a linha de cima, o próximo passo e o cancelar. */
function CardInList({
  en,
  sit,
  onCancel,
  onOpen,
}: {
  en: MyEntry;
  sit: Situation;
  onCancel: (() => void) | null;
  onOpen?: (() => void) | undefined;
}) {
  const now = Date.now();
  const closed = entrySummary(en, sit, now).group === "closed";
  return (
    <Card style={{ gap: 12, padding: 14 }}>
      <Tappable onOpen={onOpen} en={en} style={{ gap: 12 }}>
        <CareHeader en={en} sit={sit} onOpen={onOpen} />
        {closed ? null : (
          <Text style={{ fontFamily: FONT.semi, fontSize: 16, lineHeight: 22, color: COLOR.ink }}>
            {nextStep(en, sit, now)}
          </Text>
        )}
      </Tappable>
      {onCancel ? (
        <View style={{ borderTopWidth: 2, borderTopColor: COLOR.surfaceMuted, marginTop: -2 }}>
          <Button variant="dangerText" text="não vou poder ir" onPress={onCancel} />
        </View>
      ) : null}
    </Card>
  );
}

export const SECTIONS: { id: "today" | "upcoming" | "no_date" | "closed"; title: string }[] = [
  { id: "today", title: "hoje" },
  { id: "upcoming", title: "próximos" },
  { id: "no_date", title: "sem data marcada" },
  { id: "closed", title: "encerrados" },
];

/** Minha fila (T3.4): consulta a cada ~3 s enquanto está na frente (PD-33). */

/**
 * A fila da conta no município: consulta a cada ~3 s enquanto a tela está na frente (PD-33),
 * com "vou sair", "não vou poder ir" e o "é a sua vez" já dispensado. Usado por "hoje" e "atendimentos".
 */
export function useMyQueue() {
  const s = useSession();
  const [entries, setEntries] = useState<MyEntry[] | null>(null);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [seen, setSeen] = useState<string[]>(() => [...SEEN_TURNS]);
  const [leaving, setLeaving] = useState<string | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [cancel, setCancel] = useState<{ en: MyEntry; sit: Situation; ctx: string } | null>(null);
  const [cancelled, setCancelled] = useState<string | null>(null);
  const [trying, setTrying] = useState(false);
  const fetchNow = useRef<(() => Promise<void>) | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!s.municipality) return;
      let active = true;
      // Trocou de município ou de conta: nada da lista anterior fica na tela.
      setEntries(null);
      const fetch = () =>
        s.api
          .get<MyEntry[]>(`/v1/municipalities/${s.municipality}/mine`)
          .then((l) => {
            if (!active) return;
            setEntries(l);
            setError(null);
          })
          .catch((err) => {
            if (active) setError(errorNotice(err));
          });
      fetchNow.current = fetch;
      void fetch();
      const id = setInterval(fetch, QUERY_INTERVAL_MS);
      return () => {
        active = false;
        fetchNow.current = null;
        clearInterval(id);
      };
    }, [s.api, s.municipality]),
  );

  const now = Date.now();
  const list = (entries ?? []).map((en) => {
    const sit = entrySituation(en, now);
    return { en, sit, summary: entrySummary(en, sit, now) };
  });
  const turn = list.find(
    (x): x is typeof x & { sit: Extract<Situation, { kind: "turn" }> } =>
      x.sit.kind === "turn" && !seen.includes(`${x.en.entryId}:${x.en.call?.at}`),
  );

  /** "não vou poder ir" e "vou sair" de uma entrada, iguais no cartão e na tela da fila. */
  /** RN-CONF-01/04: confirmar ou recusar a data que a unidade marcou. */
  const sendAnswer = (en: MyEntry, r: "confirm" | "refuse") => {
    setAnswering(en.entryId);
    s.api
      .post<{ state: string }>(`/v1/municipalities/${s.municipality}/entries/${en.entryId}/${r}`)
      .then((res) => {
        setEntries((l) =>
          (l ?? []).map((x) =>
            x.entryId === en.entryId
              ? { ...x, state: res.state, confirmationDeadline: null, ...(r === "refuse" ? { session: null } : {}) }
              : x,
          ),
        );
        if (r === "refuse")
          Alert.alert("tudo certo", "a vaga fica para outra pessoa. você continua na lista de espera.");
        void fetchNow.current?.();
      })
      .catch((err) => Alert.alert("não deu certo", errorMessage(err)))
      .finally(() => setAnswering(null));
  };

  const actionsOf = (en: MyEntry, sit: Situation) => ({
    answer:
      sit.kind !== "allocated" || answering === en.entryId
        ? null
        : (r: "confirm" | "refuse") =>
            r === "confirm"
              ? sendAnswer(en, r)
              : Alert.alert(
                  "não pode nesta data?",
                  "a vaga fica para outra pessoa. você continua na lista, com a mesma data de entrada.",
                  [
                    { text: "voltar", style: "cancel" },
                    { text: "não posso", style: "destructive", onPress: () => sendAnswer(en, "refuse") },
                  ],
                ),
    redo: canRedo(en)
      ? () =>
          router.push({
            pathname: "/inscricao/[sessionId]",
            params: {
              sessionId: SIGN_UP_PATH.redo,
              entryId: en.entryId,
              serviceId: en.serviceId,
              service: en.service,
              unit: en.unit,
              birthDate: en.birthDate,
              forMe: en.forMe ? "1" : "0",
            },
          })
      : null,
    // RN-CANC-01: a API diz quando o "não vou poder ir" vale.
    onCancel: en.canCancel
      ? () => {
          setCancelled(null);
          setCancel({ en, sit, ctx: context(en) });
        }
      : null,
    leaving:
      leaving === en.entryId
        ? null
        : () => {
            // RN-PRES-02: volta a remoto mantendo a posição; um toque por vez.
            setLeaving(en.entryId);
            s.api
              .post(`/v1/municipalities/${s.municipality}/entries/${en.entryId}/leaving`)
              .then(() => {
                setEntries((l) => (l ?? []).map((x) => (x.entryId === en.entryId ? { ...x, itemState: "remote" } : x)));
                void fetchNow.current?.();
              })
              .catch((err) => Alert.alert("não deu certo", errorMessage(err)))
              .finally(() => setLeaving(null));
          },
  });

  return {
    entries,
    list,
    error,
    trying,
    cancelled,
    turn: turn
      ? {
          entryId: turn.en.entryId,
          ticket: turn.sit.ticket,
          station: turn.sit.station,
          dismiss: () => {
            const key = `${turn.en.entryId}:${turn.en.call?.at}`;
            SEEN_TURNS.add(key);
            setSeen((v) => [...v, key]);
          },
        }
      : null,
    tryAgain: async () => {
      setTrying(true);
      await fetchNow.current?.();
      setTrying(false);
    },
    actionsOf,
    /** Os cartões de uma lista, com as ações certas de cada um; tocar abre a tela da fila. */
    cards: (items: typeof list, variant: "highlight" | "list" = "highlight") =>
      items.map(({ en, sit }) => (
        <CareCard
          key={en.entryId}
          en={en}
          sit={sit}
          variant={variant}
          {...actionsOf(en, sit)}
          onOpen={() => router.push({ pathname: "/fila/[entryId]", params: { entryId: en.entryId } })}
        />
      )),
    /** A gaveta do "não vou poder ir"; vai uma vez na tela. */
    sheet: (
      <ConfirmCancellation
        target={cancel}
        close={() => setCancel(null)}
        confirm={async (entryId) => {
          await s.api.post(`/v1/municipalities/${s.municipality}/entries/${entryId}/cancel`);
          const notice = cancel ? cancellationNotice(cancel.sit) : cancellationNotice({ kind: "confirmed" });
          setEntries((l) => (l ?? []).filter((x) => x.entryId !== entryId));
          setCancel(null);
          setCancelled(notice);
          void fetchNow.current?.();
        }}
      />
    ),
  };
}

/** Faixa dos avisos desligados (o "saia de casa" só chega com eles ligados). */
/**
 * As abas de baixo do paciente, com o número em "atendimentos" em todas as telas. Quem já tem a lista
 * (hoje, atendimentos) passa `lista`; as outras abas buscam uma vez ao entrar na tela, sem repetir.
 */
export function PatientTabs({ current, list }: { current: AppTab; list?: { summary: { group: string } }[] }) {
  const s = useSession();
  const [fetched, setFetched] = useState<{ summary: { group: string } }[] | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (list || !s.municipality) return;
      let active = true;
      const now = Date.now();
      s.api
        .get<MyEntry[]>(`/v1/municipalities/${s.municipality}/mine`)
        .then((l) => {
          if (active) setFetched(l.map((en) => ({ summary: entrySummary(en, entrySituation(en, now), now) })));
        })
        // Sem rede, a aba só fica sem o número; a tela segue normal.
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [list, s.api, s.municipality]),
  );
  return <Tabs current={current} count={tabCount(list ?? fetched ?? [])} />;
}

/** O sininho do topo, em todas as telas com conta: abre a tela dos avisos, que mostra como eles estão. */
export function NoticeBell() {
  const s = useSession();
  if (!s.token || !s.notices) return null;
  return <BellButton off={s.notices.kind !== "on"} onPress={() => router.push("/avisos")} />;
}

export function NoticeBanner() {
  const s = useSession();
  if (!s.notices || s.notices.kind === "on") return null;
  const withoutRequest = s.notices.kind === "off" && !s.notices.canRequest;
  return (
    <Banner
      kind="notice"
      title="os avisos estão desligados"
      text="sem eles, você só sabe a hora de sair com o app aberto."
      action={{ text: withoutRequest ? "abrir os ajustes" : "ligar os avisos", onPress: () => void s.turnOnNotices() }}
    />
  );
}

// --- Aba "hoje" (design de 2026-11-16): o bilhete, as linhas e as ações raras numa gaveta ---

const TODAY_BACKGROUND = "#f4f7f8";
const SHADOW: ViewStyle = {
  shadowColor: "#0c2e4e",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

export { TODAY_BACKGROUND };

/** O bilhete do atendimento que mais pede ação agora: a faixa, o que é, o picote, a senha enorme e o botão. */
export function DayTicketCard({
  en,
  sit,
  answer,
  onOpen,
  onMore,
}: {
  en: MyEntry;
  sit: Situation;
  answer: ((r: "confirm" | "refuse") => void) | null;
  onOpen: () => void;
  onMore: () => void;
}) {
  const b = ticketCardFor(en, sit);
  return (
    <View style={[{ backgroundColor: COLOR.surface, borderRadius: 22, overflow: "hidden" }, SHADOW]}>
      <View
        style={{
          backgroundColor: COLOR.action,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 18,
          paddingRight: 8,
          paddingVertical: 6,
        }}
      >
        <Text style={{ flex: 1, fontFamily: FONT.extra, fontSize: 18, lineHeight: 24, color: "#ffffff" }}>
          {b.banner}
        </Text>
        <TappableArea
          label="mais opções"
          onPress={onMore}
          style={(pressed) => ({ padding: 10, borderRadius: 999, opacity: pressed ? 0.6 : 1 })}
        >
          <Ellipsis size={24} color="#cfe2f6" strokeWidth={2.6} />
        </TappableArea>
      </View>
      <Tappable onOpen={onOpen} en={en} style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, gap: 2 }}>
        <Text style={{ fontFamily: FONT.extra, fontSize: 21, lineHeight: 27, color: COLOR.ink }}>
          {en.service.toLowerCase()}
        </Text>
        <SoftText style={{ fontSize: 16, lineHeight: 22 }}>
          {en.unit}
          {en.forMe ? "" : `, para ${properName(en.person)}`}
        </SoftText>
      </Tappable>
      <Perforation />
      <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 }}>
        {b.ticket ? (
          <>
            <Text style={{ fontFamily: FONT.extra, fontSize: 13, letterSpacing: 1.2, color: COLOR.inkMuted }}>
              SUA SENHA
            </Text>
            <Text style={{ fontFamily: FONT.extra, fontSize: 56, lineHeight: 62, color: COLOR.primary900 }}>
              {b.ticket}
            </Text>
          </>
        ) : (
          <SoftText style={{ textAlign: "center" }}>
            {b.button === "confirm"
              ? `${en.session ? shortWindow(en.session.start, en.session.end) : ""}`
              : "a senha sai quando a fila abrir."}
          </SoftText>
        )}
        {b.button === "qr" ? (
          <View style={{ alignSelf: "stretch" }}>
            <Button text="cheguei: ler o QR" icon={QrCode} onPress={() => router.push("/check-in")} />
          </View>
        ) : null}
        {b.button === "confirm" ? (
          <View style={{ alignSelf: "stretch" }}>
            {answer ? <Button text="vou, confirmar" onPress={() => answer("confirm")} /> : <Loading />}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const shortWindow = (start: string, end: string) =>
  `${isToday(start, Date.now()) ? "hoje" : shortDay(start)}, das ${hour(start)} às ${hour(end)}`;

/** O corte do bilhete: linha tracejada com dois meios-círculos na cor do fundo. */
function Perforation() {
  const hole: ViewStyle = {
    position: "absolute",
    top: -12,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: TODAY_BACKGROUND,
  };
  return (
    <View style={{ height: 0 }}>
      <View style={{ marginHorizontal: 18, borderTopWidth: 2, borderStyle: "dashed", borderColor: COLOR.line }} />
      <View style={[hole, { left: -12 }]} />
      <View style={[hole, { right: -12 }]} />
    </View>
  );
}

/** Um atendimento de "também hoje": o quadro com a posição, o serviço e uma frase curta. */
export function DayRow({ en, sit, onOpen }: { en: MyEntry; sit: Situation; onOpen: () => void }) {
  const l = rowFor(sit);
  return (
    <TappableArea
      label={`${en.service.toLowerCase()}, ${l.sentence}`}
      onPress={onOpen}
      style={(pressed) => ({
        ...SHADOW,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 18,
        backgroundColor: pressed ? COLOR.primary50 : COLOR.surface,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COLOR.primary50,
        }}
      >
        {l.box ? (
          <Text style={{ fontFamily: FONT.extra, fontSize: 19, color: COLOR.actionPressed }}>{l.box}</Text>
        ) : (
          <Hourglass size={22} color={COLOR.action} strokeWidth={2.4} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONT.extra, fontSize: 17, lineHeight: 23, color: COLOR.ink }}>
          {en.service.toLowerCase()}
        </Text>
        <Small>{l.sentence}</Small>
      </View>
      <ChevronRight size={22} color="#9aa3a5" strokeWidth={2.5} />
    </TappableArea>
  );
}

/** "mais opções" do bilhete: só as ações que valem na situação. */
export function TicketCardOptions({
  target,
  close,
  actions,
}: {
  target: { en: MyEntry; sit: Situation } | null;
  close: () => void;
  actions: (
    en: MyEntry,
    sit: Situation,
  ) => {
    answer: ((r: "confirm" | "refuse") => void) | null;
    redo: (() => void) | null;
    onCancel: (() => void) | null;
    leaving: (() => void) | null;
  };
}) {
  const [worsened, setWorsened] = useState(false);
  const a = target ? actions(target.en, target.sit) : null;
  const present =
    target && (target.sit.kind === "position" || target.sit.kind === "no_estimate") ? target.sit.present : false;
  const doIt = (f: (() => void) | null | undefined) => () => {
    close();
    f?.();
  };
  return (
    <Sheet
      open={target !== null}
      close={() => {
        setWorsened(false);
        close();
      }}
    >
      {target && a ? (
        <>
          <Text style={{ fontFamily: FONT.extra, fontSize: 20, lineHeight: 26, color: COLOR.ink }}>
            {target.en.service.toLowerCase()}
          </Text>
          <Button
            text="ver o caminho do dia"
            variant="secondary"
            onPress={doIt(() => router.push({ pathname: "/fila/[entryId]", params: { entryId: target.en.entryId } }))}
          />
          {present && a.leaving ? (
            <Button text="vou sair um pouco" variant="secondary" onPress={doIt(a.leaving)} />
          ) : null}
          {target.sit.kind === "allocated" && a.answer ? (
            <Button text="não posso nesta data" variant="secondary" onPress={doIt(() => a.answer?.("refuse"))} />
          ) : null}
          {a.redo ? (
            <Button variant="text" text="minha situação mudou: responder de novo" onPress={doIt(a.redo)} />
          ) : null}
          {present && !worsened ? (
            <Button variant="dangerText" text="meus sintomas pioraram" onPress={() => setWorsened(true)} />
          ) : null}
          {present && worsened ? (
            <View style={{ gap: 10 }}>
              <Banner kind="danger" title="seus sintomas pioraram?" text={WORSENED_GUIDANCE} />
              <CallButton text="ligar para o SAMU (192)" number="192" variant="secondary" />
            </View>
          ) : null}
          {a.onCancel ? (
            <Button
              variant="dangerText"
              text={target.sit.kind === "allocated" ? "sair da lista de espera" : "não vou poder ir"}
              onPress={doIt(a.onCancel)}
            />
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
