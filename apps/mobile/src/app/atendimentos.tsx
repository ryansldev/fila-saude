import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { PatientTabs, useMyQueue } from "@/components/care";
import { Banner, Button, Card, Loading, Screen, Segmented, SoftText, TappableCard, Title } from "@/components/ui";

type Tab = "upcoming" | "history";

/**
 * Meus atendimentos: o que está marcado para outros dias, a lista de espera e a reserva ("próximos"),
 * e o que já terminou ("histórico"). O de hoje fica na aba "hoje".
 */
export default function Appointments() {
  const f = useMyQueue();
  const [tab, setTab] = useState<Tab>("upcoming");
  const upcoming = f.list
    .filter((x) => x.summary.group === "upcoming" || x.summary.group === "no_date")
    .sort((a, b) => (a.en.session?.start ?? "9").localeCompare(b.en.session?.start ?? "9"));
  const history = f.list.filter((x) => x.summary.group === "closed");
  const fromToday = f.list.filter((x) => x.summary.group === "today").length;
  const items = tab === "upcoming" ? upcoming : history;

  return (
    <Screen back={false} footer={<PatientTabs current="appointments" list={f.list} />}>
      <Title>meus atendimentos</Title>
      <Segmented
        current={tab}
        change={setTab}
        options={[
          { id: "upcoming", label: `próximos${upcoming.length > 0 ? ` (${upcoming.length})` : ""}` },
          { id: "history", label: `histórico${history.length > 0 ? ` (${history.length})` : ""}` },
        ]}
      />
      {f.error ? (
        <Banner
          kind="danger"
          title={f.error.title}
          text={f.error.text}
          action={{ text: "tentar de novo", onPress: () => void f.tryAgain(), loading: f.trying }}
        />
      ) : null}
      {f.cancelled ? <Banner kind="ok" title="pronto, inscrição cancelada" text={f.cancelled} /> : null}
      {fromToday > 0 && tab === "upcoming" ? (
        <TappableCard action="ver o de hoje" onPress={() => router.replace("/inicio")}>
          <SoftText>
            {fromToday === 1 ? "você tem 1 atendimento hoje." : `você tem ${fromToday} atendimentos hoje.`}
          </SoftText>
        </TappableCard>
      ) : null}
      {f.entries === null && !f.error ? <Loading text="buscando os seus atendimentos…" /> : null}
      {f.entries !== null && items.length === 0 ? (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
          <SoftText style={{ textAlign: "center" }}>
            {tab === "upcoming"
              ? "nenhum atendimento marcado para os próximos dias."
              : "os atendimentos que terminarem aparecem aqui."}
          </SoftText>
          {tab === "upcoming" ? (
            <View style={{ alignSelf: "stretch" }}>
              <Button text="procurar uma unidade" onPress={() => router.replace("/unidades")} />
            </View>
          ) : null}
        </Card>
      ) : null}
      {f.cards(items, "list")}
      {f.sheet}
    </Screen>
  );
}
