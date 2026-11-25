import { router, useLocalSearchParams } from "expo-router";
import { Building2, Check, Clock, UserRound } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { NoticeBanner, useMyQueue, YourTurn } from "@/components/care";
import {
  Badge,
  Banner,
  Button,
  CallButton,
  COLOR,
  FONT,
  Loading,
  Pill,
  Screen,
  Small,
  SoftText,
  Title,
  toneColor,
} from "@/components/ui";
import { properName } from "@/lib/account";
import { hour } from "@/lib/dates";
import { type QueueHighlight, queueHighlight, queueSteps, type Step, waitFigure } from "@/lib/queue";
import { canCheckIn, entrySummary, nextStep, WORSENED_GUIDANCE } from "@/lib/texts";

/**
 * Tela da fila de um atendimento: a senha bem grande, a posição e o tempo, a linha do tempo do dia
 * e o que fazer agora. Consulta a cada ~3 s, como "hoje" (PD-33); a vez abre a tela verde.
 */
export default function QueueScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const f = useMyQueue();
  const [worsened, setWorsened] = useState(false);
  const item = f.list.find((x) => x.en.entryId === entryId);
  // "meus sintomas pioraram" vale para esta ida à unidade: some ao sair ou ao abrir outro atendimento.
  const inUnit = item?.en.itemState === "present";
  // biome-ignore lint/correctness/useExhaustiveDependencies: `entryId` e `inUnit` são os gatilhos.
  useEffect(() => {
    setWorsened(false);
  }, [entryId, inUnit]);

  if (f.turn && f.turn.entryId === entryId) {
    return <YourTurn ticket={f.turn.ticket} station={f.turn.station} close={f.turn.dismiss} />;
  }
  if (f.entries === null) {
    return (
      <Screen>
        {f.error ? (
          <Banner
            kind="danger"
            title={f.error.title}
            text={f.error.text}
            action={{ text: "tentar de novo", onPress: () => void f.tryAgain(), loading: f.trying }}
          />
        ) : (
          <Loading text="buscando a sua fila" />
        )}
      </Screen>
    );
  }
  if (!item) {
    // Cancelada agora há pouco (ou de outra conta): a entrada some da lista.
    return (
      <Screen
        actions={
          <Button text="voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/inicio"))} />
        }
      >
        <Title>{f.cancelled ? "pronto" : "inscrição não encontrada"}</Title>
        <SoftText>{f.cancelled ?? "ela não está mais na sua lista."}</SoftText>
      </Screen>
    );
  }

  const { en, sit } = item;
  const now = Date.now();
  const r = entrySummary(en, sit, now);
  const highlight = queueHighlight(en, sit);
  const steps = queueSteps(en, sit);
  const { onCancel, leaving } = f.actionsOf(en, sit);
  const present = (sit.kind === "position" || sit.kind === "no_estimate") && sit.present;
  const checkIn = canCheckIn(sit, en.itemState);

  const primary =
    sit.kind === "reception" ? (
      <Button text="ler o QR de novo" variant="secondary" onPress={() => router.push("/check-in")} />
    ) : checkIn ? (
      <Button text="cheguei na unidade" onPress={() => router.push("/check-in")} />
    ) : present ? (
      leaving ? (
        <Button text="vou sair um pouco" variant="secondary" onPress={leaving} />
      ) : (
        <Loading />
      )
    ) : null;

  return (
    <Screen actions={primary}>
      <View style={{ gap: 6 }}>
        <Title>{en.service.toLowerCase()}</Title>
        {/* Horário, unidade e para quem viram pílulas (nada de "Info · Info · Info"). */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {en.session ? (
            <Pill
              text={`${hour(en.session.start, en.timeZone)} às ${hour(en.session.end, en.timeZone)}`}
              Icon={Clock}
              tone="blue"
            />
          ) : null}
          <Pill text={en.unit} Icon={Building2} tone="blue" />
          {en.forMe ? null : <Pill text={`para ${properName(en.person)}`} Icon={UserRound} tone="blue" />}
        </View>
        <Badge text={r.badge} tone={r.tone} />
      </View>

      <TicketBlock d={highlight} />

      {f.error ? <Banner kind="notice" title={f.error.title} text={f.error.text} /> : null}

      <Text style={{ fontFamily: FONT.extra, fontSize: 20, lineHeight: 28, color: COLOR.ink }}>
        {nextStep(en, sit, now)}
      </Text>

      {r.inQueue ? <NoticeBanner /> : null}

      {steps.length > 0 ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: FONT.extra, fontSize: 18, color: COLOR.ink }}>seu caminho hoje</Text>
          <TimeRow steps={steps} />
        </View>
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
      {onCancel ? <Button variant="dangerText" text="não vou poder ir" onPress={onCancel} /> : null}
      {f.sheet}
    </Screen>
  );
}

/** A senha bem grande, na cor da situação; na fila, a posição e o tempo ao lado um do outro. */
function TicketBlock({ d }: { d: QueueHighlight }) {
  const t = toneColor(d.tone);
  const turn = d.tone === "green" && d.room !== undefined;
  const background = turn ? COLOR.call : t.background;
  const ink = turn ? "#ffffff" : t.text;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ borderRadius: 24, padding: 20, gap: 14, backgroundColor: background, alignItems: "center" }}
    >
      <Text style={{ fontFamily: FONT.bold, fontSize: 17, color: ink }}>{d.label}</Text>
      {d.ticket ? (
        <Text
          accessibilityLabel={`senha ${d.ticket}`}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{
            fontFamily: FONT.extra,
            fontSize: 76,
            lineHeight: 84,
            letterSpacing: 2,
            color: turn ? "#ffffff" : COLOR.ink,
          }}
        >
          {d.ticket}
        </Text>
      ) : null}
      {d.room ? (
        <Text style={{ fontFamily: FONT.extra, fontSize: 26, lineHeight: 32, color: ink }}>{d.room}</Text>
      ) : null}
      {d.position !== undefined ? (
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
          <Figure value={`${d.position}º`} legend="na fila" />
          <Figure {...waitFigure(d)} />
        </View>
      ) : null}
    </View>
  );
}

function Figure({ value, legend }: { value: string; legend: string }) {
  return (
    <View
      style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 16, backgroundColor: COLOR.surface }}
    >
      <Text style={{ fontFamily: FONT.extra, fontSize: 32, lineHeight: 38, color: COLOR.action }}>{value}</Text>
      <Small>{legend}</Small>
    </View>
  );
}

/** Etapas do dia, de cima para baixo: feitas com ✓, a de agora em destaque, as próximas apagadas. */
function TimeRow({ steps }: { steps: Step[] }) {
  return (
    <View accessibilityRole="list">
      {steps.map((p, i) => {
        const last = i === steps.length - 1;
        const done = p.state === "done";
        const now = p.state === "current" || p.state === "pending";
        const color = done || p.state === "current" ? COLOR.action : p.state === "pending" ? "#9aa3a5" : COLOR.line;
        return (
          <View
            key={p.id}
            accessibilityLabel={`${p.title}: ${done ? "feito" : now ? "agora" : "depois"}`}
            style={{ flexDirection: "row", gap: 14, minHeight: 52 }}
          >
            <View style={{ alignItems: "center", width: 30 }}>
              <View
                style={{
                  width: now ? 30 : 24,
                  height: now ? 30 : 24,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: done ? COLOR.action : COLOR.surface,
                  borderWidth: done ? 0 : now ? 4 : 3,
                  borderColor: color,
                  borderStyle: p.state === "pending" ? "dashed" : "solid",
                }}
              >
                {done ? <Check size={14} color="#ffffff" strokeWidth={3.5} /> : null}
              </View>
              {last ? null : (
                <View
                  style={{ flex: 1, width: 4, marginVertical: 2, backgroundColor: done ? COLOR.action : COLOR.line }}
                />
              )}
            </View>
            <Text
              style={{
                flex: 1,
                paddingTop: now ? 3 : 1,
                fontFamily: now ? FONT.extra : FONT.semi,
                fontSize: now ? 19 : 16,
                color: p.state === "future" ? COLOR.inkMuted : COLOR.ink,
              }}
            >
              {p.title}
              {now ? (p.state === "pending" ? " · ainda não começou" : " · agora") : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
