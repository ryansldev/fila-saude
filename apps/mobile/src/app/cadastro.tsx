import { maskCpf, maskData, maskPhone } from "@fila-saude/schemas/masks";
import { router } from "expo-router";
import { Check, Circle } from "lucide-react-native";
import { useState } from "react";
import { type KeyboardTypeOptions, Text, View } from "react-native";
import { Banner, Button, Card, COLOR, Field, FONT, LinoBubble, PasswordField, Screen } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  nextStep,
  passwordRule,
  previousStep,
  REGISTRATION_STEPS,
  type RegistrationData,
  type RegistrationStep,
  registrationPayload,
  registrationSummary,
  serverErrorStep,
  serverErrorText,
  stepError,
} from "@/lib/registration";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/texts";

type Question = {
  speech: string;
  label: string;
  hint?: string;
  mask?: (t: string) => string;
  keyboard?: KeyboardTypeOptions;
  max?: number;
  example?: string;
  extra?: Partial<React.ComponentProps<typeof Field>>;
};

const QUESTIONS: Record<Exclude<RegistrationStep, "review" | "password">, Question> = {
  name: {
    speech: "oi! vamos criar a sua conta. qual é o seu nome completo?",
    label: "nome completo",
    extra: { autoComplete: "name", autoCapitalize: "words" },
  },
  cpf: {
    speech: "e o seu CPF?",
    label: "CPF",
    hint: "só para te identificar na unidade.",
    mask: maskCpf,
    keyboard: "number-pad",
    max: 14,
    example: "000.000.000-00",
  },
  birthDate: {
    speech: "quando você nasceu?",
    label: "data de nascimento",
    mask: maskData,
    keyboard: "number-pad",
    max: 10,
    example: "dd/mm/aaaa",
    extra: { autoComplete: "birthdate-full" },
  },
  phone: {
    speech: "qual é o seu celular?",
    label: "celular",
    hint: "com DDD. a unidade usa se precisar falar com você.",
    mask: maskPhone,
    keyboard: "phone-pad",
    max: 15,
    example: "(00) 00000-0000",
    extra: { autoComplete: "tel", textContentType: "telephoneNumber" },
  },
  email: {
    speech: "e o seu e-mail?",
    label: "e-mail",
    hint: "para avisos da sua conta.",
    keyboard: "email-address",
    example: "seu@email.com",
    extra: { autoComplete: "email", textContentType: "emailAddress", autoCorrect: false, autoCapitalize: "none" },
  },
};

/** Criar conta: o Dr. Lino pergunta uma coisa por tela; no fim, confira e crie. */
export default function Registration() {
  const s = useSession();
  const [step, setStep] = useState<RegistrationStep>("name");
  const [fixing, setFixing] = useState(false);
  const [v, setV] = useState<RegistrationData>({
    name: "",
    cpf: "",
    email: "",
    phone: "",
    birthDate: "",
    password: "",
  });
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Recusa do servidor que é de um campo (CPF ou e-mail já com conta): aparece embaixo dele.
  const [serverError, setServerError] = useState<{
    step: "cpf" | "email";
    text: string;
    code: string;
  } | null>(null);
  const [sending, setSending] = useState(false);

  const go = (p: RegistrationStep) => {
    setStep(p);
    setTried(false);
    setError(null);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace("/boas-vindas"));
  const back = () => {
    const previous = fixing ? "review" : previousStep(step);
    if (previous === null) leave();
    else {
      if (previous === "review") setFixing(false);
      go(previous);
    }
  };
  const change = (k: keyof RegistrationData) => (t: string) => {
    setV({ ...v, [k]: t });
    if (serverError?.step === k) setServerError(null);
  };
  const screenError = serverError?.step === step ? serverError.text : tried ? stepError(step, v) : undefined;

  function proceed() {
    setTried(true);
    if (stepError(step, v) || serverError?.step === step) return;
    const next = nextStep(step, fixing);
    if (next === "review") setFixing(false);
    go(next);
  }

  async function create() {
    if (sending) return;
    // Algo inválido (não deveria chegar aqui): volta à primeira tela com erro.
    const withError = REGISTRATION_STEPS.find((p) => stepError(p, v));
    if (withError) {
      go(withError);
      setTried(true);
      return;
    }
    // O servidor já recusou um campo que não mudou: volta a ele em vez de mandar de novo.
    if (serverError) {
      go(serverError.step);
      return;
    }
    setSending(true);
    setError(null);
    try {
      await s.register(registrationPayload(v));
      // Pilha nova: o "voltar" não leva de volta ao cadastro, ao login ou ao "conhecer o app".
      if (router.canDismiss()) router.dismissAll();
      router.replace("/");
    } catch (err) {
      const code = (err instanceof ApiError ? err.error : (err as { error?: string }).error) ?? "";
      const destination = serverErrorStep(code);
      if (destination) {
        setServerError({
          step: destination,
          code,
          text: serverErrorText(code) ?? errorMessage(err),
        });
        setFixing(true);
        go(destination);
      } else setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const progress = { current: REGISTRATION_STEPS.indexOf(step) + 1, total: REGISTRATION_STEPS.length };

  if (step === "review")
    return (
      <Screen
        progress={progress}
        onBack={back}
        onClose={leave}
        actions={<Button text="criar conta" onPress={create} loading={sending} />}
      >
        <LinoBubble text="confira os seus dados." />
        <Card style={{ gap: 0, paddingVertical: 6 }}>
          {registrationSummary(v).map((l, i) => (
            <View
              key={l.step}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 8,
                borderTopWidth: i === 0 ? 0 : 1,
                borderColor: COLOR.line,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONT.bold, fontSize: 14, color: COLOR.inkMuted }}>{l.label}</Text>
                <Text style={{ fontFamily: FONT.extra, fontSize: 18, lineHeight: 24, color: COLOR.ink }}>
                  {l.value}
                </Text>
              </View>
              <Button
                variant="text"
                size="medium"
                text="corrigir"
                onPress={() => {
                  setFixing(true);
                  go(l.step);
                }}
              />
            </View>
          ))}
        </Card>
        {error ? <Banner kind="danger" title={error} /> : null}
      </Screen>
    );

  const actions = (
    <>
      <Button text="continuar" onPress={proceed} />
      {step === "name" && !fixing ? (
        <Button variant="text" text="já tenho conta" onPress={() => router.replace("/entrar")} />
      ) : null}
      {serverError?.step === "cpf" && step === "cpf" && serverError.code === "cpf_in_use" ? (
        <Button
          variant="secondary"
          text="entrar com este CPF"
          onPress={() => router.replace({ pathname: "/entrar", params: { cpf: v.cpf } })}
        />
      ) : null}
    </>
  );

  if (step === "password") {
    const rule = passwordRule(v.password);
    const Brand = rule.eightCharacters ? Check : Circle;
    return (
      <Screen progress={progress} onBack={back} onClose={leave} actions={actions}>
        <LinoBubble text="crie uma senha para entrar no app." />
        <PasswordField
          key="senha"
          label="senha"
          error={screenError}
          value={v.password}
          onChangeText={change("password")}
          autoComplete="new-password"
          autoFocus
          onSubmitEditing={proceed}
        />
        <View
          accessibilityLabel={`pelo menos 8 caracteres${rule.eightCharacters ? ", ok" : ""}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Brand size={18} color={rule.eightCharacters ? COLOR.successInk : "#9aa3a5"} strokeWidth={2.6} />
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 16,
              color: rule.eightCharacters ? COLOR.successInk : COLOR.inkMuted,
            }}
          >
            pelo menos 8 caracteres
          </Text>
        </View>
      </Screen>
    );
  }

  const q = QUESTIONS[step];
  const value = v[step];
  return (
    <Screen progress={progress} onBack={back} onClose={leave} actions={actions}>
      <LinoBubble text={q.speech} />
      <Field
        key={step}
        label={q.label}
        hint={q.hint}
        error={screenError}
        value={value}
        onChangeText={(t) => change(step)(q.mask ? q.mask(t) : t)}
        keyboardType={q.keyboard}
        maxLength={q.max}
        placeholder={q.example}
        autoFocus
        returnKeyType="next"
        onSubmitEditing={proceed}
        {...q.extra}
      />
    </Screen>
  );
}
