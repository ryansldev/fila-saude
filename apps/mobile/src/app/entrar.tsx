import { maskCpf } from "@fila-saude/schemas/masks";
import { router, useLocalSearchParams } from "expo-router";
import { IdCard, KeyRound } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { CaptchaSheet } from "@/components/captcha-sheet";
import {
  Banner,
  Button,
  COLOR,
  DoctorSpeech,
  Field,
  FONT,
  LinoBubble,
  PasswordField,
  Screen,
  Sheet,
  SoftText,
} from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/texts";
import { missingInLogin } from "@/lib/validation";

/** Entrar: o Dr. Lino recebe quem volta; o que falta é dito no próprio campo. */
export default function SignIn() {
  const s = useSession();
  // Vindo do cadastro com "entrar com este CPF", o CPF já vem preenchido.
  const params = useLocalSearchParams<{ cpf?: string }>();
  const [cpf, setCpf] = useState(params.cpf ? maskCpf(params.cpf) : "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [forgot, setForgot] = useState(false);
  // AD-064: passado o teto de erros no login, a API pede o captcha antes de conferir a senha.
  const [captcha, setCaptcha] = useState(false);
  // CPF errado ou campo vazio é apontado no campo, antes de ir ao servidor (e gastar uma tentativa).
  const noShow = tried ? missingInLogin(cpf, password) : {};

  async function send(captchaToken?: string) {
    setTried(true);
    const f = missingInLogin(cpf, password);
    if (f.cpf || f.password || sending) return;
    setSending(true);
    setError(null);
    try {
      await s.signIn(cpf, password, captchaToken);
      // Pilha nova: o "voltar" não leva de volta ao cadastro, ao login ou ao "conhecer o app".
      if (router.canDismiss()) router.dismissAll();
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.error === "captcha_required") setCaptcha(true);
      else setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen
      actions={
        <>
          <Button text="entrar" onPress={() => send()} loading={sending} />
          <Button variant="text" text="ainda não tenho conta" onPress={() => router.replace("/cadastro")} />
        </>
      }
      footer={
        <>
          <CaptchaSheet
            open={captcha}
            close={() => setCaptcha(false)}
            onToken={(token) => {
              setCaptcha(false);
              void send(token);
            }}
          />
          <Sheet open={forgot} close={() => setForgot(false)}>
            <DoctorSpeech greeting="sem problema" text="a recepção da sua unidade troca a senha para você." />
            <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <IdCard size={24} color={COLOR.action} strokeWidth={2.3} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONT.extra, fontSize: 17, lineHeight: 24, color: COLOR.ink }}>
                  leve um documento com foto
                </Text>
                <SoftText style={{ fontSize: 16, lineHeight: 22 }}>RG, CNH ou outro com o seu CPF.</SoftText>
              </View>
            </View>
            <Button
              text="ver as unidades perto de mim"
              onPress={() => {
                setForgot(false);
                // Sem município escolhido, a lista de unidades não sabe de onde mostrar.
                router.push(s.municipality ? "/unidades" : { pathname: "/municipio", params: { next: "unidades" } });
              }}
            />
            <Button variant="text" text="voltar para entrar" onPress={() => setForgot(false)} />
          </Sheet>
        </>
      }
    >
      <LinoBubble text="que bom te ver de novo! entre com o seu CPF e a senha." />
      <Field
        label="CPF"
        value={cpf}
        error={noShow.cpf}
        onChangeText={(t) => {
          setCpf(maskCpf(t));
          setError(null);
        }}
        keyboardType="number-pad"
        placeholder="000.000.000-00"
        maxLength={14}
        autoComplete="username"
        textContentType="username"
      />
      <PasswordField
        label="senha"
        value={password}
        error={noShow.password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        autoComplete="current-password"
        onSubmitEditing={() => void send()}
        returnKeyType="go"
      />
      <View style={{ alignItems: "flex-end", marginTop: -8 }}>
        <Button variant="text" size="medium" icon={KeyRound} text="esqueci a senha" onPress={() => setForgot(true)} />
      </View>
      {error ? <Banner kind="danger" title={error} /> : null}
    </Screen>
  );
}
