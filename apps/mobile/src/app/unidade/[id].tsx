import type { MyEntry, PublicUnit, ScheduleSession, UnitService } from "@fila-saude/schemas/queue";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Building2, Check, ClipboardList, Clock, MapPin, Navigation, Stethoscope, Ticket } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import {
  Avatar,
  Banner,
  BodyText,
  Button,
  Card,
  COLOR,
  DayStrip,
  FONT,
  Loading,
  MonthCalendar,
  Pill,
  Screen,
  Small,
  SoftText,
  Title,
  type Tone,
} from "@/components/ui";
import { hour } from "@/lib/dates";
import { dayKey, daysWithCare, monthGrid, monthYear, validDay } from "@/lib/days";
import { useSession } from "@/lib/session";
import { type ServiceWithList, servicesWithList, signUpInSchedule } from "@/lib/sign-ups";
import { errorNotice } from "@/lib/texts";
import { directionsLink, kindName } from "@/lib/units";

const slots = (x: ScheduleSession): { text: string; tone: Tone } =>
  x.remainingSlots === null
    ? { text: "vagas livres", tone: "green" }
    : x.remainingSlots === 0
      ? { text: "sem vagas: entra na reserva", tone: "yellow" }
      : { text: x.remainingSlots === 1 ? "1 vaga" : `${x.remainingSlots} vagas`, tone: "green" };

async function openDirections(u: PublicUnit) {
  const link = directionsLink(u, Platform.OS);
  try {
    await Linking.openURL(link);
  } catch {
    // Sem app de mapas que entenda o geo: abre o Google Maps no navegador.
    await Linking.openURL(directionsLink(u, "web")).catch(() => undefined);
  }
}

/** Uma sessão do dia escolhido: o serviço, a situação, o horário e o profissional, e o botão. */
function SessionCard({ x, unit, mine }: { x: ScheduleSession; unit: string; mine: MyEntry[] | null }) {
  const situation = signUpInSchedule(x, mine);
  const signedUp = situation.kind === "signed_up";
  // Dono já no serviço: ainda dá para inscrever outra pessoa (o "para mim" fica desligado
  // na próxima tela). Só sem nada a fazer o botão leva à minha fila.
  const onlySee = signedUp && !situation.canOther;
  const v = slots(x);
  const signUp = () =>
    router.push({
      pathname: "/inscricao/[sessionId]",
      params: {
        sessionId: x.id,
        serviceId: x.service.id,
        service: x.service.name,
        unit,
        start: x.start,
        open: x.state === "open" ? "1" : "0",
      },
    });
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: FONT.extra, fontSize: 20, lineHeight: 26, color: COLOR.ink }}>
          {x.service.name.toLowerCase()}
        </Text>
        {signedUp ? (
          <Pill text="você está inscrito" tone="green" Icon={Check} />
        ) : (
          <Pill text={v.text} tone={v.tone} Icon={Ticket} />
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Clock size={18} color={COLOR.inkMuted} strokeWidth={2.4} />
          <Small>
            {hour(x.start)} às {hour(x.end)}
          </Small>
        </View>
        {x.professional ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Stethoscope size={18} color={COLOR.inkMuted} strokeWidth={2.4} />
            <Small>{x.professional}</Small>
          </View>
        ) : null}
        {x.state === "open" ? <Pill text="fila andando" tone="blue" /> : null}
      </View>
      {onlySee ? <Small>sua conta já inscreveu o máximo de pessoas nesta data.</Small> : null}
      <View style={{ alignItems: "flex-end" }}>
        {onlySee ? (
          <Button text="ver minha fila" variant="secondary" size="medium" onPress={() => router.replace("/inicio")} />
        ) : signedUp ? (
          <Button text="outra pessoa" variant="secondary" size="medium" onPress={signUp} />
        ) : (
          <Button text="quero ir" size="medium" onPress={signUp} />
        )}
      </View>
    </Card>
  );
}

const SERVICE_TEXT: Record<"referral" | "regulated", string> = {
  referral: "pede a requisição do médico. leve o papel à recepção.",
  regulated: "marcado pela regulação. procure a sua UBS.",
};

/** T5.1 / I1: um serviço com lista de espera; regulado e requisição só explicam. */
function ServiceCard({ x, unit }: { x: ServiceWithList; unit: string }) {
  const enters = x.kind === "sign_in" || x.kind === "in_list";
  const enter = () =>
    router.push({
      pathname: "/inscricao/[sessionId]",
      params: { sessionId: "lista", serviceId: x.id, service: x.name, unit },
    });
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar Icon={ClipboardList} tone={x.kind === "in_list" ? "green" : enters ? "blue" : "gray"} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: FONT.extra, fontSize: 18, lineHeight: 24, color: COLOR.ink }}>
            {x.name.toLowerCase()}
          </Text>
          {x.kind === "in_list" ? <Pill text="na lista" tone="green" Icon={Check} /> : null}
          {x.kind === "referral" || x.kind === "regulated" ? <Small>{SERVICE_TEXT[x.kind]}</Small> : null}
        </View>
      </View>
      {enters ? (
        <View style={{ alignItems: "flex-end" }}>
          <Button
            text={x.kind === "in_list" ? "outra pessoa" : "entrar na lista"}
            variant="secondary"
            size="medium"
            onPress={enter}
          />
        </View>
      ) : null}
    </Card>
  );
}

/** Uma unidade: endereço, "como chegar" e os próximos atendimentos abertos para inscrição. */
export default function Unit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useSession();
  const [unit, setUnit] = useState<PublicUnit | "not_found" | null>(null);
  const [sessions, setSessions] = useState<ScheduleSession[] | null>(null);
  const [unitServices, setUnitServices] = useState<UnitService[] | null>(null);
  // AD-032: as inscrições da conta, para não oferecer de novo um serviço em que a pessoa já está.
  const [mine, setMine] = useState<MyEntry[] | null>(null);
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const [trying, setTrying] = useState(false);

  const fetch = useCallback(
    () =>
      Promise.all([
        s.api.get<PublicUnit[]>(`/v1/municipalities/${s.municipality}/units`),
        s.api.get<ScheduleSession[]>(`/v1/municipalities/${s.municipality}/schedule`),
        s.api.get<MyEntry[]>(`/v1/municipalities/${s.municipality}/mine`),
        s.api.get<UnitService[]>(`/v1/municipalities/${s.municipality}/units/${id}/services`),
      ])
        .then(([us, ag, m, sv]) => {
          setUnitServices(sv);
          setUnit(us.find((u) => u.id === id) ?? "not_found");
          setSessions(ag.filter((x) => x.unit.id === id).sort((a, b) => a.start.localeCompare(b.start)));
          setMine(m);
          setError(null);
        })
        .catch((err) => setError(errorNotice(err, "confira a conexão e tente de novo."))),
    [s.api, s.municipality, id],
  );
  // Volta depois de se inscrever: busca de novo, para o cartão já dizer "inscrito".
  useFocusEffect(
    useCallback(() => {
      void fetch();
    }, [fetch]),
  );

  const back = () => (router.canGoBack() ? router.back() : router.replace("/unidades"));
  // A faixa: só os dias com atendimento; o escolhido volta ao primeiro se o dia sumir.
  const days = useMemo(
    () =>
      daysWithCare(
        (sessions ?? []).map((x) => x.start),
        Date.now(),
      ),
    [sessions],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const day = validDay(chosen, days);
  const [calendar, setCalendar] = useState(false);
  const months = useMemo(() => {
    const withValue = new Set(days.map((d) => d.key));
    const today = dayKey(new Date().toISOString());
    return [...new Set(days.map((d) => d.key.slice(0, 7)))].map((am) => {
      const [a, m] = am.split("-").map(Number);
      return { title: monthYear(`${am}-01`), weeks: monthGrid(a ?? 0, m ?? 1, withValue, today) };
    });
  }, [days]);

  if (unit === "not_found")
    return (
      <Screen onBack={back} actions={<Button text="ver as unidades" onPress={() => router.replace("/unidades")} />}>
        <Banner
          kind="notice"
          title="unidade não encontrada"
          text="ela pode ter saído do app. veja a lista de unidades do seu município."
        />
      </Screen>
    );

  return (
    <Screen onBack={back}>
      {error ? (
        <Banner
          kind="danger"
          title={error.title}
          text={error.text}
          action={{
            text: "tentar de novo",
            loading: trying,
            onPress: async () => {
              setTrying(true);
              await fetch();
              setTrying(false);
            },
          }}
        />
      ) : null}
      {unit === null && !error ? <Loading text="buscando a unidade…" /> : null}
      {unit ? (
        <>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
              <Avatar Icon={Building2} tone={(sessions?.length ?? 0) > 0 ? "green" : "gray"} />
              <View style={{ flex: 1, gap: 4 }}>
                <Title>{unit.name}</Title>
                <Pill text={kindName(unit.kind)} tone="blue" />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <MapPin size={20} color={COLOR.inkMuted} strokeWidth={2.25} style={{ marginTop: 4 }} />
              <View style={{ flex: 1 }}>
                <BodyText style={{ fontFamily: FONT.bold }}>
                  {unit.address.street}, {unit.address.number}
                </BodyText>
                <SoftText>
                  {unit.address.neighborhood}, CEP {unit.address.postalCode.replace(/^(\d{5})(\d{3})$/, "$1-$2")}
                </SoftText>
              </View>
            </View>
            <View style={{ alignItems: "flex-start" }}>
              <Button
                text="como chegar"
                variant="secondary"
                size="medium"
                icon={Navigation}
                onPress={() => void openDirections(unit)}
              />
            </View>
          </Card>
          {sessions?.length === 0 ? (
            <View style={{ gap: 4, paddingVertical: 16 }}>
              <BodyText style={{ fontFamily: FONT.bold, textAlign: "center" }}>
                nenhum atendimento aberto para inscrição agora nesta unidade
              </BodyText>
              <SoftText style={{ textAlign: "center" }}>
                novas datas aparecem aqui quando a unidade abre as inscrições.
              </SoftText>
            </View>
          ) : null}
          {days.length > 0 ? (
            <>
              <Text style={{ fontFamily: FONT.extra, fontSize: 22, lineHeight: 28, color: COLOR.ink, marginTop: 8 }}>
                escolha o dia
              </Text>
              <DayStrip days={days} current={day} change={setChosen} onOpenCalendar={() => setCalendar(true)} />
              {(sessions ?? [])
                .filter((x) => dayKey(x.start) === day)
                .map((x) => (
                  <SessionCard key={x.id} x={x} unit={unit.name} mine={mine} />
                ))}
            </>
          ) : null}
          {unitServices && unitServices.length > 0 ? (
            <>
              <Text style={{ fontFamily: FONT.extra, fontSize: 22, lineHeight: 28, color: COLOR.ink, marginTop: 8 }}>
                lista de espera
              </Text>
              <SoftText style={{ marginTop: -8 }}>a unidade marca a data e avisa no app.</SoftText>
              {servicesWithList(unitServices, mine).map((x) => (
                <ServiceCard key={x.id} x={x} unit={unit.name} />
              ))}
            </>
          ) : null}
        </>
      ) : null}
      <MonthCalendar
        open={calendar}
        close={() => setCalendar(false)}
        months={months}
        current={day}
        onChoose={setChosen}
      />
    </Screen>
  );
}
