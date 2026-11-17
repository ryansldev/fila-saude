import { maskCpf, maskData } from "@fila-saude/schemas/masks";
import type { MyEntry, Relationship, ScheduleSession, SignUpInput } from "@fila-saude/schemas/queue";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Building2, CalendarDays, Lock, Stethoscope, Timer, UserRound } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  Badge,
  Banner,
  BodyText,
  Button,
  CallButton,
  COLOR,
  Field,
  FONT,
  LinoBubble,
  Loading,
  Mascot,
  Option,
  Pill,
  Screen,
  Small,
  SoftText,
  Title,
} from "@/components/ui";
import { firstName, properName } from "@/lib/account";
import { ApiError } from "@/lib/api";
import { shortDay } from "@/lib/dates";
import {
  type AppAnswers,
  complete,
  EMPTY_ANSWERS,
  markMultiple,
  NONE,
  QUESTIONS,
  type Screen as QuestionnaireScreen,
  questionnaireOutcome,
  questionSpeech,
  screensOf,
  TRUTH_WARNING,
} from "@/lib/questionnaire";
import { useSession } from "@/lib/session";
import {
  type CheckError,
  checkError,
  declaration,
  doneTitle,
  forMeInService,
  otherPersonAlreadySignedUp,
  type PersonStep,
  RELATIONSHIPS,
  type SignUpEnd,
  signUpForWhom,
  signUpMode,
  signUpRequest,
  stepOfError,
} from "@/lib/sign-ups";
import { errorMessage, errorNotice } from "@/lib/texts";
import { dataIso, otherPersonError } from "@/lib/validation";

type Step =
  | { kind: "who" }
  /** Outra pessoa: um dado por tela e, por fim, a relação com a declaração (2026-11-16). */
  | { kind: "person"; detail: PersonStep }
  /** Antes do questionário: "agora umas perguntinhas rápidas". */
  | { kind: "intro" }
  | { kind: "question"; index: number }
  | { kind: "emergency" }
  | { kind: "support" }
  | { kind: "signed_up" }
  | { kind: "reserve" }
  /** Serviço com requisição: inscrito, mas o pedido médico ainda precisa chegar à unidade. */
  | { kind: "request" }
  /** T5.1: entrou na lista de espera do serviço (modo "lista"). */
  | { kind: "list" }
  /** RN-RISCO-03: respostas novas salvas (modo "refazer"). */
  | { kind: "redone"; level: string };

type SessionData = {
  serviceId?: string;
  service?: string;
  unit?: string;
  start?: string;
  /** Fuso da unidade: o dia da sessão aparece nele. */
  timeZone?: string;
  open?: boolean;
};

const goToMyQueue = () => router.dismissTo("/inicio");
const goToSchedule = () => router.dismissTo("/unidades");

/** T3.3: "para quem é?" (AD-018), questionário v1 e a inscrição, como no design do app. */
export default function SignUp() {
  const p = useLocalSearchParams<{
    sessionId: string;
    serviceId?: string;
    service?: string;
    unit?: string;
    start?: string;
    timeZone?: string;
    open?: string;
    /** Modo "refazer": a entrada, a data de nascimento de quem é atendido e se é a própria conta. */
    entryId?: string;
    birthDate?: string;
    forMe?: string;
  }>();
  const s = useSession();
  // "lista" e "refazer" no lugar do id da sessão: a mesma tela entra na lista ou refaz o questionário.
  const mode = signUpMode(p.sessionId);
  const endpoints = signUpRequest(mode, s.municipality ?? "", p);
  const [step, setStep] = useState<Step>(mode === "redo" ? { kind: "question", index: 0 } : { kind: "who" });
  const [forWhom, setForWhom] = useState<"me" | "other" | null>(mode === "redo" && p.forMe !== "1" ? "other" : "me");
  const [other, setOther] = useState({ name: "", birthDate: "", cpf: "" });
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [declared, setDeclared] = useState(false);
  const [r, setR] = useState<AppAnswers>(EMPTY_ANSWERS);
  const [none, setNone] = useState<Partial<Record<QuestionnaireScreen, boolean>>>({});
  const [error, setError] = useState<{ text: string; duplicate: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [triedForWhom, setTriedForWhom] = useState(false);
  // Recusa do /verificar no passo "para quem" (antes do questionário).
  const [forWhomError, setForWhomError] = useState<CheckError | null>(null);
  const [checking, setChecking] = useState(false);
  // Dois toques no mesmo instante não mandam duas inscrições.
  const sendingRef = useRef(false);

  // Pelo link (deep link) a tela chega só com o id da sessão: o resto vem da agenda.
  const hasEverything = Boolean(p.serviceId && p.service && p.unit && (mode !== "session" || p.start));
  const [fromSchedule, setFromSchedule] = useState<ScheduleSession | null | "out">(null);
  // AD-032: as inscrições da conta, para não oferecer de novo o que a pessoa já tem.
  const [mine, setMine] = useState<MyEntry[] | null>(null);
  const [loadError, setLoadError] = useState<{ title: string; text: string } | null>(null);
  const [trying, setTrying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, schedule] = await Promise.all([
        s.api.get<MyEntry[]>(`/v1/municipalities/${s.municipality}/mine`),
        hasEverything
          ? Promise.resolve(null)
          : s.api.get<ScheduleSession[]>(`/v1/municipalities/${s.municipality}/schedule`),
      ]);
      setMine(m);
      if (schedule) setFromSchedule(schedule.find((x) => x.id === p.sessionId) ?? "out");
      setLoadError(null);
    } catch (err) {
      setLoadError(errorNotice(err, "confira a conexão e tente de novo."));
    }
  }, [s.api, s.municipality, p.sessionId, hasEverything]);
  useEffect(() => {
    if (s.municipality) void load();
  }, [load, s.municipality]);

  const session: SessionData =
    fromSchedule && fromSchedule !== "out"
      ? {
          serviceId: fromSchedule.service.id,
          service: fromSchedule.service.name,
          unit: fromSchedule.unit.name,
          start: fromSchedule.start,
          timeZone: fromSchedule.unit.timeZone,
          open: fromSchedule.state === "open",
        }
      : {
          ...(p.serviceId ? { serviceId: p.serviceId } : {}),
          ...(p.service ? { service: p.service } : {}),
          ...(p.unit ? { unit: p.unit } : {}),
          ...(p.start ? { start: p.start } : {}),
          ...(p.timeZone ? { timeZone: p.timeZone } : {}),
          open: p.open === "1",
        };
  const ownerSignedUp = forMeInService(mine, session.serviceId);
  const loaded = mine !== null && (hasEverything || fromSchedule !== null);

  const screens = screensOf(r);
  // Sem a data da conta carregada, não dá para decidir emergência/apoio pela idade: espera.
  const birthDate =
    mode === "redo" ? (p.birthDate ?? "") : forWhom === "me" ? (s.account?.birthDate ?? "") : dataIso(other.birthDate);

  // Para outra pessoa, só monta com a relação e a declaração que a pessoa marcou (senão, `null`).
  const buildForWhom = (q: "me" | "other") => signUpForWhom(q, other, relationship, declared);

  async function send() {
    if (!complete(r) || sendingRef.current || !forWhom) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    const pq = mode === "redo" ? null : buildForWhom(forWhom);
    if (mode !== "redo" && !pq) {
      sendingRef.current = false;
      setSending(false);
      return setStep({ kind: "person", detail: "relationship" });
    }
    const body: SignUpInput | { answers: AppAnswers } =
      mode === "redo" || !pq ? { answers: r } : { forWhom: pq, answers: r };
    try {
      const res = await s.api.post<{ state?: string; classification: { level: string } }>(endpoints.send, body);
      if (mode === "redo") return setStep({ kind: "redone", level: res.classification.level });
      if (mode === "list") return setStep({ kind: "list" });
      setStep({
        kind: res.state === "in_reserve" ? "reserve" : res.state === "awaiting_referral" ? "request" : "signed_up",
      });
    } catch (err) {
      setError({ text: errorMessage(err), duplicate: err instanceof ApiError && err.error === "duplicate" });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  /** "para quem" → confere na API (sem gravar) o que a inscrição recusaria; só então começa o questionário. */
  async function checkForWhom(q: "me" | "other") {
    if (checking) return;
    setChecking(true);
    setForWhomError(null);
    try {
      // A lista de espera não tem o "/verificar": as recusas vêm no envio, no fim do questionário.
      const pq = buildForWhom(q);
      if (!pq) return;
      if (endpoints.check) await s.api.post(endpoints.check, { forWhom: pq });
      setForWhom(q);
      setStep({ kind: "intro" });
    } catch (err) {
      const e = checkError(err);
      setForWhomError(e);
      // Recusa de um dado da outra pessoa: volta para a tela dele, com a mensagem no campo.
      const screen = q === "other" ? stepOfError(e) : null;
      if (screen) setStep({ kind: "person", detail: screen });
    } finally {
      setChecking(false);
    }
  }

  function advance() {
    if (step.kind !== "question") return;
    if (screens[step.index] === "alarms") {
      const d = questionnaireOutcome(r, birthDate, Date.now());
      if (d === "emergency") return setStep({ kind: "emergency" });
      if (d === "support") return setStep({ kind: "support" });
    }
    if (step.index + 1 < screens.length) return setStep({ kind: "question", index: step.index + 1 });
    void send();
  }

  // "para quem é" (+ os 4 passos da outra pessoa) + a apresentação + uma pergunta por tela; o resultado
  // enche a barra. Refazer vai direto às perguntas.
  const before = mode === "redo" ? 0 : forWhom === "other" ? 6 : 2;
  const total = before + screens.length;
  // O primeiro nome digitado; quando ainda não há (refazer de outra pessoa), as falas dizem "a pessoa".
  const shortName = firstName(other.name);
  const care = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {session.service ? <Pill text={session.service.toLowerCase()} Icon={Stethoscope} tone="blue" /> : null}
      {session.unit ? <Pill text={session.unit} Icon={Building2} tone="blue" /> : null}
      {session.start ? <Pill text={shortDay(session.start, session.timeZone)} Icon={CalendarDays} tone="blue" /> : null}
    </View>
  );

  // Pelo link (deep link), a tela pode abrir sem conta ou sem município escolhido.
  if (s.ready && !s.token)
    return (
      <Screen
        back={false}
        actions={
          <>
            <Button text="entrar" onPress={() => router.replace("/entrar")} />
            <Button variant="text" text="criar conta" onPress={() => router.replace("/boas-vindas")} />
          </>
        }
      >
        <Banner
          kind="notice"
          title="entre na sua conta"
          text="para se inscrever neste atendimento, entre no app e escolha o atendimento de novo."
          style={{ marginTop: 8 }}
        />
      </Screen>
    );
  if (s.ready && !s.municipality) return <Redirect href="/municipio" />;
  if (!s.ready) return <Loading full />;

  const ENDS: Record<string, SignUpEnd> = {
    list: "list",
    redone: "redone",
    signed_up: "signed_up",
    reserve: "reserve",
    request: "request",
  };
  const end = ENDS[step.kind];
  if (end) {
    const t = doneTitle(end, forWhom, shortName);
    const after: Record<SignUpEnd, string | null> = {
      signed_up: session.open
        ? "a fila de hoje já começou: a senha e a posição já estão em minha fila."
        : "não precisa confirmar. no dia, a gente avisa quando a fila começar e a hora de sair de casa.",
      list: "a unidade marca a data e avisa aqui. aí é só confirmar. quem tem mais urgência ou prioridade pela lei é chamado antes.",
      reserve: "se alguém desistir, a vaga passa para a reserva e avisamos na hora.",
      request: "a inscrição está feita. a vaga só fica garantida quando a unidade receber o pedido.",
      redone:
        step.kind === "redone" && step.level === "urgent"
          ? "pela resposta, a equipe vai olhar o caso com prioridade."
          : null,
    };
    return (
      <Screen
        progress={{ current: total, total }}
        onBack={goToMyQueue}
        actions={<Button text="ver minha fila" onPress={goToMyQueue} />}
      >
        <View style={{ alignItems: "center", gap: 4 }}>
          <Mascot size={160} frame={false} />
          <Title style={{ textAlign: "center" }}>{t.title}</Title>
          <BodyText style={{ textAlign: "center" }}>{t.text}</BodyText>
        </View>
        {end !== "redone" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {session.service ? <Pill text={session.service.toLowerCase()} Icon={Stethoscope} tone="blue" /> : null}
            {session.start ? (
              <Pill text={shortDay(session.start, session.timeZone)} Icon={CalendarDays} tone="blue" />
            ) : null}
            {session.unit ? <Pill text={session.unit} Icon={Building2} tone="blue" /> : null}
            {forWhom === "other" ? <Pill text={properName(other.name)} Icon={UserRound} tone="blue" /> : null}
          </View>
        ) : null}
        {after[end] ? <SoftText style={{ textAlign: "center" }}>{after[end]}</SoftText> : null}
      </Screen>
    );
  }

  if (step.kind === "emergency")
    return (
      <Screen
        back={false}
        background={COLOR.dangerBg}
        actions={
          <>
            <CallButton text="ligar 192 · SAMU" number="192" variant="danger" />
            <Button
              text="voltar às perguntas"
              variant="secondary"
              onPress={() => setStep({ kind: "question", index: 0 })}
            />
          </>
        }
      >
        <Banner
          kind="danger"
          title="isso pode ser uma emergência"
          text="não espere na fila."
          style={{ backgroundColor: "#ffffff", marginTop: 8 }}
        />
        <Title style={{ color: COLOR.dangerInk }}>procure atendimento agora</Title>
        <BodyText>ligue para o SAMU ou vá ao pronto-socorro mais perto.</BodyText>
      </Screen>
    );

  if (step.kind === "support")
    return (
      <Screen
        back={false}
        actions={
          <>
            <CallButton text="ligar 188 · CVV" number="188" />
            <CallButton text="ligar 192 · SAMU" number="192" variant="secondary" />
            <Button
              variant="text"
              text="continuar a inscrição"
              onPress={() => setStep({ kind: "question", index: 1 })}
            />
          </>
        }
      >
        <Title style={{ marginTop: 8 }}>você não está sozinho</Title>
        <BodyText>conversar ajuda. o CVV atende 24 horas, de graça e em sigilo.</BodyText>
        <Small>
          você também pode continuar a inscrição. a equipe da unidade vai saber que você precisa de atenção.
        </Small>
      </Screen>
    );

  // Recusa da API que é de um campo: aparece embaixo dele.
  const apiCpfError = forWhomError?.kind === "field" ? forWhomError.text : undefined;
  const apiPersonError = forWhomError?.kind === "person" ? forWhomError.text : undefined;
  const apiBanner =
    forWhomError?.kind === "banner" ? (
      <Banner kind="danger" title={forWhomError.title} text={forWhomError.text} />
    ) : null;
  const apiExit =
    forWhomError?.kind === "banner" && forWhomError.exit ? (
      <Button
        text={forWhomError.exit === "schedule" ? "ver os atendimentos" : "ver minha fila"}
        onPress={forWhomError.exit === "schedule" ? goToSchedule : goToMyQueue}
      />
    ) : null;

  if (step.kind === "who") {
    // Pelo link, a sessão pode já ter fechado ou não ser aberta ao público.
    if (fromSchedule === "out")
      return (
        <Screen actions={<Button text="ver os atendimentos" onPress={() => router.replace("/unidades")} />}>
          <Banner
            kind="notice"
            title="este atendimento não está aberto"
            text="as inscrições acabaram ou ele é só por agendamento da unidade."
            style={{ marginTop: 8 }}
          />
          <SoftText>veja os próximos atendimentos do seu município.</SoftText>
        </Screen>
      );

    const chosen = forWhom === "me" && ownerSignedUp ? null : forWhom;
    const readyAccount = chosen === "other" || (chosen === "me" && Boolean(s.account?.birthDate));
    // Sem as inscrições da conta, só deixa seguir se a busca falhou (a API ainda recusa a duplicada).
    const can = readyAccount && (loaded || loadError !== null);
    return (
      <Screen
        progress={{ current: 1, total }}
        // Aberta pelo link, não há tela anterior: o X leva aos atendimentos.
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/unidades"))}
        actions={
          apiExit ?? (
            <Button
              text="continuar"
              disabled={!can}
              loading={checking}
              onPress={() => {
                if (chosen === "me") void checkForWhom("me");
                else if (chosen === "other") setStep({ kind: "person", detail: "name" });
              }}
            />
          )
        }
      >
        <LinoBubble text="oi! esse atendimento é para quem?" />
        {care}
        {/* No alto, para ser vista sem rolar: o botão de baixo vira a saída. */}
        {apiBanner}
        {loadError ? (
          <Banner
            kind="danger"
            title={loadError.title}
            text={loadError.text}
            action={{
              text: "tentar de novo",
              loading: trying,
              onPress: async () => {
                setTrying(true);
                await load();
                setTrying(false);
              },
            }}
          />
        ) : null}
        {!loaded && !loadError ? (
          <Loading text="conferindo suas inscrições…" />
        ) : (
          <>
            {ownerSignedUp ? (
              <View
                accessible
                accessibilityRole="radio"
                accessibilityState={{ disabled: true, checked: false }}
                accessibilityLabel="para mim. indisponível: você já está inscrito neste serviço."
                style={{
                  gap: 8,
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: COLOR.line,
                  backgroundColor: COLOR.surfaceMuted,
                }}
              >
                <Text style={{ fontFamily: FONT.bold, fontSize: 18, lineHeight: 24, color: COLOR.inkMuted }}>
                  para mim
                </Text>
                <Badge text="inscrito" tone="green" />
                <Small>cada pessoa entra uma vez em cada serviço. sua inscrição está em minha fila.</Small>
              </View>
            ) : (
              <Option
                text="para mim"
                single
                checked={chosen === "me"}
                onPress={() => {
                  setForWhom("me");
                  setForWhomError(null);
                }}
              />
            )}
            <Option
              text="para outra pessoa"
              single
              checked={chosen === "other"}
              onPress={() => {
                setForWhom("other");
                setForWhomError(null);
              }}
            />
          </>
        )}
      </Screen>
    );
  }

  if (step.kind === "person") {
    const detail = step.detail;
    const order: PersonStep[] = ["name", "birthDate", "cpf", "relationship"];
    const i = order.indexOf(detail);
    const go = (d: PersonStep | undefined) => {
      setTriedForWhom(false);
      setStep(d ? { kind: "person", detail: d } : { kind: "who" });
    };
    const errors = otherPersonError(other, s.account?.cpf);
    const repeated = otherPersonAlreadySignedUp(mine, session.serviceId, {
      name: other.name,
      birthDate: dataIso(other.birthDate),
      cpf: other.cpf,
    });
    const changeOther = (v: Partial<typeof other>) => {
      setOther({ ...other, ...v });
      setForWhomError(null);
      // A declaração é sobre esta pessoa: mudou um dado, marca de novo.
      setDeclared(false);
    };
    const progress = { current: 2 + i, total };

    if (detail === "relationship")
      return (
        <Screen
          progress={progress}
          onBack={() => go("cpf")}
          actions={
            apiExit ?? (
              <Button
                text="continuar"
                disabled={!relationship || !declared}
                loading={checking}
                onPress={() => void checkForWhom("other")}
              />
            )
          }
        >
          <LinoBubble text={`e qual a sua relação com ${shortName}?`} />
          {apiBanner}
          {RELATIONSHIPS.map((rel) => (
            <Option
              key={rel.id}
              text={rel.text(shortName)}
              single
              checked={relationship === rel.id}
              onPress={() => {
                // A declaração muda com a relação: trocar pede marcar de novo.
                if (rel.id !== relationship) setDeclared(false);
                setRelationship(rel.id);
              }}
            />
          ))}
          {relationship ? (
            <>
              <Small style={{ fontFamily: FONT.extra, marginBottom: -6 }}>para continuar</Small>
              <Option
                text={declaration(relationship, shortName)}
                checked={declared}
                onPress={() => setDeclared(!declared)}
              />
            </>
          ) : null}
          <Small>você recebe os avisos e leva {shortName} no dia. a recepção vê que foi você quem inscreveu.</Small>
        </Screen>
      );

    const field = {
      name: {
        speech: "qual é o nome da pessoa que vai ser atendida?",
        label: "nome da pessoa",
        value: other.name,
        change: (t: string) => changeOther({ name: t }),
        error: apiPersonError ?? (triedForWhom ? errors.name : undefined),
        extra: { autoCapitalize: "words" as const, placeholder: "nome completo" },
      },
      birthDate: {
        speech: `e quando ${shortName} nasceu?`,
        label: `nascimento de ${shortName}`,
        value: other.birthDate,
        change: (t: string) => changeOther({ birthDate: maskData(t) }),
        error: apiPersonError ? "confira a data de nascimento." : triedForWhom ? errors.birthDate : undefined,
        extra: { keyboardType: "number-pad" as const, maxLength: 10, placeholder: "dd/mm/aaaa" },
      },
      cpf: {
        speech: `${shortName} tem CPF? se não tiver, tudo bem.`,
        label: `CPF de ${shortName}`,
        value: other.cpf,
        change: (t: string) => changeOther({ cpf: maskCpf(t) }),
        error:
          apiCpfError ??
          (triedForWhom
            ? (errors.cpf ??
              (repeated ? "esta pessoa já está inscrita neste serviço pela sua conta. veja em minha fila." : undefined))
            : undefined),
        extra: { keyboardType: "number-pad" as const, maxLength: 14, placeholder: "000.000.000-00" },
      },
    }[detail];
    const proceed = () => {
      setTriedForWhom(true);
      if (errors[detail] || (detail === "cpf" && repeated)) return;
      go(order[i + 1]);
    };
    return (
      <Screen
        progress={progress}
        onBack={() => go(order[i - 1])}
        actions={
          <>
            <Button text="continuar" onPress={proceed} />
            {detail === "cpf" ? (
              <Button
                variant="text"
                text={`${shortName} não tem CPF`}
                onPress={() => {
                  changeOther({ cpf: "" });
                  if (
                    !otherPersonAlreadySignedUp(mine, session.serviceId, {
                      ...other,
                      birthDate: dataIso(other.birthDate),
                      cpf: "",
                    })
                  )
                    go("relationship");
                  else setTriedForWhom(true);
                }}
              />
            ) : null}
          </>
        }
      >
        <Pill text="dados de quem vai ser atendido" Icon={UserRound} tone="blue" />
        <LinoBubble text={field.speech} />
        <Field
          key={detail}
          label={field.label}
          value={field.value}
          onChangeText={field.change}
          error={field.error}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={proceed}
          {...field.extra}
        />
      </Screen>
    );
  }

  if (step.kind === "intro")
    return (
      <Screen
        progress={{ current: before, total }}
        onBack={() => setStep(forWhom === "other" ? { kind: "person", detail: "relationship" } : { kind: "who" })}
        actions={<Button text="vamos lá" onPress={() => setStep({ kind: "question", index: 0 })} />}
      >
        <LinoBubble
          text={
            forWhom === "other"
              ? `agora umas perguntinhas rápidas sobre ${shortName}, para a unidade atender melhor.`
              : "agora umas perguntinhas rápidas, para a unidade te atender melhor."
          }
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill text="1 minuto" Icon={Timer} tone="blue" />
          <Pill text="só a equipe da unidade vê" Icon={Lock} tone="blue" />
        </View>
      </Screen>
    );

  // Os fins já voltaram acima pelo mapa `ENDS`; aqui só sobram as perguntas.
  if (step.kind !== "question") return null;
  const screen = screens[step.index] as QuestionnaireScreen;
  const question = QUESTIONS[screen];
  const value = r[screen];
  const list = Array.isArray(value) ? (value as string[]) : [];
  const answered = question.multiple ? list.length > 0 || Boolean(none[screen]) : value !== null;
  const last = step.index + 1 === screens.length;
  const speech = questionSpeech(screen, forWhom, shortName);

  function mark(op: string) {
    setError(null);
    if (!question.multiple)
      return setR({ ...r, [screen]: op, ...(screen === "reason" && op !== "new" ? { severity: null } : {}) });
    const marked = markMultiple(list, Boolean(none[screen]), op);
    setNone({ ...none, [screen]: marked.none });
    setR({ ...r, [screen]: marked.answers });
  }

  // Voltar vai à pergunta anterior (ou a "para quem é"), sem perder as respostas.
  const index = step.index;
  return (
    <Screen
      progress={{ current: index + 1 + before, total }}
      onBack={() => {
        setError(null);
        if (index === 0 && mode === "redo") return router.canGoBack() ? router.back() : goToMyQueue();
        setStep(index > 0 ? { kind: "question", index: index - 1 } : { kind: "intro" });
      }}
      actions={
        error?.duplicate ? (
          <Button text="ver minha fila" onPress={goToMyQueue} />
        ) : (
          <Button
            text={
              !last
                ? "continuar"
                : mode === "list"
                  ? "entrar na lista"
                  : mode === "redo"
                    ? "salvar respostas"
                    : "concluir inscrição"
            }
            onPress={advance}
            disabled={!answered}
            loading={sending}
          />
        )
      }
    >
      <LinoBubble text={speech} />
      {index === 0 ? <Banner kind="info" title={TRUTH_WARNING.title} text={TRUTH_WARNING.text} /> : null}
      {/* A resposta da maioria vem primeiro (2026-11-16). */}
      {question.none ? (
        <>
          <Option text={question.none} checked={Boolean(none[screen])} onPress={() => mark(NONE)} />
          <Small style={{ textAlign: "center" }}>ou marque o que tiver</Small>
        </>
      ) : null}
      {question.options.map(([id, text]) => (
        <Option
          key={id}
          text={text}
          single={!question.multiple}
          checked={question.multiple ? list.includes(id) : value === id}
          onPress={() => mark(id)}
        />
      ))}
      {screen === "groups" && r.groups.length > 0 ? (
        <Banner
          kind="info"
          title="vamos conferir na unidade"
          text="leve um documento que comprove. declarar o que não é verdade pode ser crime."
        />
      ) : null}
      {error ? (
        <Banner
          kind="danger"
          title={error.duplicate ? "já inscrito neste serviço" : "não deu para concluir"}
          text={error.text}
        />
      ) : null}
    </Screen>
  );
}
