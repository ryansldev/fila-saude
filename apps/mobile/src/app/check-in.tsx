import type { CheckIn } from "@fila-saude/schemas/queue";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { Camera } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { Banner, Button, COLOR, FONT, Screen, SoftText } from "@/components/ui";
import { checkInText, fromParameters, type ReadQr, readQr } from "@/lib/check-in";
import { useSession } from "@/lib/session";
import { errorMessage } from "@/lib/texts";

type State =
  | { kind: "reading" }
  | { kind: "sending" }
  | {
      kind: "end";
      result: "present" | "reception" | "no_ticket";
      rows: string[];
      banner?: { title: string; text: string } | undefined;
    }
  | { kind: "error"; text: string };

const white = { color: "#ffffff" };

/** RN-PRES-01: "estou na unidade". Abre pelo link do QR (câmera do celular) ou pelo leitor do app. */
export default function CheckInByQr() {
  const params = useLocalSearchParams<{ m?: string; u?: string; t?: string }>();
  const s = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<State>({ kind: "reading" });
  const [cannotRead, setCannotRead] = useState(false);
  const read = useRef(false);
  // O link do QR (câmera do celular) é usado uma vez; depois, "ler de novo" abre a câmera.
  const usedLink = useRef(false);

  const send = useCallback(
    async (qr: ReadQr) => {
      if (read.current) return;
      read.current = true;
      setState({ kind: "sending" });
      try {
        const r = await s.api.post<CheckIn>(`/v1/municipalities/${qr.municipality}/check-in`, {
          unitId: qr.unitId,
          tokens: qr.tokens,
        });
        // Só troca de município quando o check-in achou alguma senha da conta naquele município.
        if (r.length > 0 && s.municipality !== qr.municipality) await s.chooseMunicipality(qr.municipality);
        const { kind, rows, banner } = checkInText(r);
        setState({ kind: "end", result: kind, rows, banner });
      } catch (err) {
        setState({ kind: "error", text: errorMessage(err) });
      }
    },
    [s],
  );

  useEffect(() => {
    if (!s.ready || !s.token || usedLink.current) return;
    const fromLink = fromParameters(params);
    if (fromLink) {
      usedLink.current = true;
      void send(fromLink);
    }
  }, [s.ready, s.token, params, send]);

  const again = () => {
    read.current = false;
    setState({ kind: "reading" });
  };
  const seeQueue = () => router.replace("/inicio");

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
          text="para confirmar a chegada, entre no app e leia o QR da TV de novo."
          style={{ marginTop: 8 }}
        />
      </Screen>
    );

  if (state.kind === "end" && state.result === "no_ticket")
    return (
      <Screen back={false} actions={<Button text="ver minha fila" onPress={seeQueue} />}>
        <Banner kind="info" title="nenhuma senha aqui agora" text={state.rows.join(" ")} style={{ marginTop: 8 }} />
        <SoftText>confira se é a unidade certa e se o seu atendimento é hoje. na dúvida, fale com a recepção.</SoftText>
      </Screen>
    );

  if (state.kind === "end" && state.result === "present")
    return (
      <Screen back={false} actions={<Button text="ver minha fila" onPress={seeQueue} />}>
        <Banner
          kind="ok"
          large
          title="você está na unidade"
          text="fique de olho na TV e no celular."
          style={{ marginTop: 8 }}
        />
        {state.rows.map((l) => (
          <SoftText key={l}>{l}</SoftText>
        ))}
      </Screen>
    );

  if (state.kind === "end")
    return (
      <Screen back={false} actions={<Button text="ver minha fila" onPress={seeQueue} />}>
        <Banner
          kind="notice"
          large
          title={state.banner?.title ?? "passe na recepção"}
          text={state.banner?.text ?? "para confirmar seus documentos."}
          style={{ marginTop: 8 }}
        />
        {state.rows.map((l) => (
          <SoftText key={l}>{l}</SoftText>
        ))}
        <SoftText>só na primeira vez. depois disso, é só ler o QR.</SoftText>
      </Screen>
    );

  if (state.kind === "error")
    return (
      <Screen
        back={false}
        actions={
          <>
            <Button text="ler de novo" onPress={again} />
            <Button text="ver minha fila" variant="secondary" onPress={seeQueue} />
          </>
        }
      >
        <Banner kind="danger" title="não deu certo" text={state.text} style={{ marginTop: 8 }} />
        <SoftText>se continuar dando errado, peça ajuda na recepção: eles marcam a sua presença.</SoftText>
      </Screen>
    );

  const sending = state.kind === "sending" || (!usedLink.current && Boolean(fromParameters(params)));
  return (
    <Screen
      background={COLOR.primary900}
      top={false}
      actions={
        <>
          {!permission?.granted ? (
            // Negou de vez: o pedido não aparece mais; só os ajustes do celular liberam a câmera.
            permission && !permission.canAskAgain ? (
              <Button text="liberar a câmera nos ajustes" onPress={() => void Linking.openSettings()} />
            ) : (
              <Button text="permitir a câmera" onPress={() => void requestPermission()} />
            )
          ) : null}
          <Button
            variant="text"
            text={cannotRead ? "esconder ajuda" : "não consigo ler"}
            onPress={() => setCannotRead(!cannotRead)}
          />
          <Button variant="text" text="voltar" onPress={() => (router.canGoBack() ? router.back() : seeQueue())} />
        </>
      }
    >
      <Text style={{ fontFamily: FONT.extra, fontSize: 28, lineHeight: 34, marginTop: 8, ...white }}>
        {sending ? "confirmando sua chegada…" : "aponte para o QR da TV"}
      </Text>
      <Text style={{ fontFamily: FONT.regular, fontSize: 18, lineHeight: 28, ...white }}>
        ele fica na TV da sala de espera ou na recepção.
      </Text>
      <View
        style={{
          alignSelf: "center",
          width: 260,
          height: 260,
          borderWidth: 4,
          borderColor: "#ffffff",
          borderRadius: 16,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {permission?.granted && !sending ? (
          <CameraView
            style={{ width: "100%", height: "100%" }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              const qr = readQr(data);
              if (qr) void send(qr);
            }}
          />
        ) : sending ? (
          <ActivityIndicator size="large" color="#ffffff" />
        ) : (
          <View style={{ alignItems: "center", gap: 12, padding: 16 }}>
            <Camera size={48} color="#ffffff" strokeWidth={2} />
            <Text style={{ fontFamily: FONT.semi, fontSize: 17, lineHeight: 24, textAlign: "center", ...white }}>
              a câmera aparece aqui
            </Text>
          </View>
        )}
      </View>
      {cannotRead ? (
        <Text style={{ fontFamily: FONT.regular, fontSize: 18, lineHeight: 28, textAlign: "center", ...white }}>
          sem problema: peça ajuda na recepção. eles marcam a sua presença.
        </Text>
      ) : null}
    </Screen>
  );
}
