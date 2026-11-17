import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import {
  DayRow,
  DayTicketCard,
  PatientTabs,
  TicketCardOptions,
  TODAY_BACKGROUND,
  useMyQueue,
  YourTurn,
} from "@/components/care";
import { Banner, Button, COLOR, FONT, Loading, Mascot, Screen, Small } from "@/components/ui";
import { firstName } from "@/lib/account";
import { dayGreeting, dayParts, hour } from "@/lib/dates";
import { useSession } from "@/lib/session";
import { sortForDay } from "@/lib/today";

/**
 * Hoje (aba principal, design de 2026-11-16): o atendimento que mais pede ação vira o bilhete, com a
 * senha enorme; os outros do dia, uma linha cada. O resto (outros dias, lista de espera) fica em
 * "atendimentos", com o número na aba.
 */
export default function Today() {
  const s = useSession();
  const f = useMyQueue();
  const [options, setOptions] = useState<{
    en: (typeof f.list)[number]["en"];
    sit: (typeof f.list)[number]["sit"];
  } | null>(null);
  if (f.turn) return <YourTurn ticket={f.turn.ticket} station={f.turn.station} close={f.turn.dismiss} />;

  const fromToday = sortForDay(f.list.filter((x) => x.summary.group === "today"));
  const [ticketCard, ...also] = fromToday;
  const next = f.list
    .filter((x) => x.summary.group === "upcoming" && x.en.session)
    .sort((a, b) => (a.en.session?.start ?? "").localeCompare(b.en.session?.start ?? ""))[0];
  const name = s.account?.name ? firstName(s.account.name) : undefined;
  const summary =
    fromToday.length === 0
      ? "hoje está livre."
      : fromToday.length === 1
        ? "você tem 1 atendimento hoje."
        : `você tem ${fromToday.length} atendimentos hoje.`;
  const open = (entryId: string) => () => router.push({ pathname: "/fila/[entryId]", params: { entryId } });

  return (
    <Screen back={false} background={TODAY_BACKGROUND} footer={<PatientTabs current="today" list={f.list} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mascot size={64} frame={false} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONT.extra, fontSize: 24, lineHeight: 30, color: COLOR.ink }}>
            {dayGreeting(Date.now())}
            {name ? `, ${name}` : ""}!
          </Text>
          <Small style={{ fontSize: 16 }}>{summary}</Small>
        </View>
      </View>
      {f.error ? (
        <Banner
          kind="danger"
          title={f.error.title}
          text={f.error.text}
          action={{ text: "tentar de novo", onPress: () => void f.tryAgain(), loading: f.trying }}
        />
      ) : null}
      {f.cancelled ? <Banner kind="ok" title="pronto, inscrição cancelada" text={f.cancelled} /> : null}
      {f.entries === null && !f.error ? <Loading text="buscando o seu dia…" /> : null}
      {ticketCard ? (
        <DayTicketCard
          en={ticketCard.en}
          sit={ticketCard.sit}
          answer={f.actionsOf(ticketCard.en, ticketCard.sit).answer}
          onOpen={open(ticketCard.en.entryId)}
          onMore={() => setOptions({ en: ticketCard.en, sit: ticketCard.sit })}
        />
      ) : null}
      {also.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: FONT.extra, fontSize: 14, letterSpacing: 1, color: COLOR.inkMuted }}>
            TAMBÉM HOJE
          </Text>
          {also.map((x) => (
            <DayRow key={x.en.entryId} en={x.en} sit={x.sit} onOpen={open(x.en.entryId)} />
          ))}
        </View>
      ) : null}
      {f.entries !== null && fromToday.length === 0 ? (
        next?.en.session ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: FONT.extra, fontSize: 14, letterSpacing: 1, color: COLOR.inkMuted }}>
              PRÓXIMO ATENDIMENTO
            </Text>
            <DayRow en={next.en} sit={next.sit} onOpen={open(next.en.entryId)} />
            <Small>
              {(() => {
                const p = dayParts(next.en.session.start, Date.now(), next.en.timeZone);
                return `${p.top === "amanhã" ? "amanhã" : `${p.top}, ${p.day} de ${p.month}`}, às ${hour(next.en.session.start, next.en.timeZone)}`;
              })()}
            </Small>
          </View>
        ) : (
          <Button
            text="ver as unidades"
            variant="secondary"
            icon={MapPin}
            onPress={() => router.replace("/unidades")}
          />
        )
      ) : null}
      <TicketCardOptions target={options} close={() => setOptions(null)} actions={f.actionsOf} />
      {f.sheet}
    </Screen>
  );
}
