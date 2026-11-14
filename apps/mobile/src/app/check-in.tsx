import type { CheckIn } from "@fila-saude/schemas/fila";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Botao, COR, Espaco, Faixa, FONTE, LinkBotao, Tela, TextoSuave } from "@/components/ui";
import { deParametros, lerQr, type QrLido, textoDoCheckIn } from "@/lib/check-in";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

type Estado =
  | { tipo: "lendo" }
  | { tipo: "enviando" }
  | { tipo: "fim"; resultado: "presente" | "recepcao" | "sem_senha"; linhas: string[] }
  | { tipo: "erro"; texto: string };

const branco = { color: "#ffffff" };

/** RN-PRES-01: "estou na unidade". Abre pelo link do QR (câmera do celular) ou pelo leitor do app. */
export default function CheckInPeloQr() {
  const params = useLocalSearchParams<{ m?: string; u?: string; t?: string }>();
  const s = useSessao();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>({ tipo: "lendo" });
  const [naoLe, setNaoLe] = useState(false);
  const lido = useRef(false);
  // O link do QR (câmera do celular) é usado uma vez; depois, "ler de novo" abre a câmera.
  const linkUsado = useRef(false);

  const enviar = useCallback(
    async (qr: QrLido) => {
      if (lido.current) return;
      lido.current = true;
      setEstado({ tipo: "enviando" });
      try {
        const r = await s.api.post<CheckIn>(`/v1/municipios/${qr.municipio}/check-in`, {
          unidadeId: qr.unidadeId,
          tokens: qr.tokens,
        });
        // Só troca de município depois de um check-in aceito.
        if (s.municipio !== qr.municipio) await s.escolherMunicipio(qr.municipio);
        const { tipo, linhas } = textoDoCheckIn(r);
        setEstado({ tipo: "fim", resultado: tipo, linhas });
      } catch (err) {
        setEstado({ tipo: "erro", texto: mensagemDoErro(err) });
      }
    },
    [s],
  );

  useEffect(() => {
    if (!s.pronto || !s.token || linkUsado.current) return;
    const doLink = deParametros(params);
    if (doLink) {
      linkUsado.current = true;
      void enviar(doLink);
    }
  }, [s.pronto, s.token, params, enviar]);

  const deNovo = () => {
    lido.current = false;
    setEstado({ tipo: "lendo" });
  };
  const verFila = () => router.replace("/inicio");

  if (s.pronto && !s.token)
    return (
      <Tela voltar={false}>
        <Faixa
          tipo="aviso"
          titulo="entre na sua conta"
          texto="para confirmar a chegada, entre no app e leia o QR da TV de novo."
          style={{ marginTop: 8 }}
        />
        <Espaco />
        <Botao texto="entrar" onPress={() => router.replace("/entrar")} />
        <LinkBotao texto="criar conta" onPress={() => router.replace("/boas-vindas")} />
      </Tela>
    );

  if (estado.tipo === "fim" && estado.resultado === "sem_senha")
    return (
      <Tela voltar={false}>
        <Faixa tipo="info" titulo="nenhuma senha aqui agora" texto={estado.linhas.join(" ")} style={{ marginTop: 8 }} />
        <TextoSuave>
          confira se é a unidade certa e se o seu atendimento é hoje. na dúvida, fale com a recepção.
        </TextoSuave>
        <Espaco />
        <Botao texto="ver minha fila" onPress={verFila} />
      </Tela>
    );

  if (estado.tipo === "fim" && estado.resultado === "presente")
    return (
      <Tela voltar={false}>
        <Faixa
          tipo="ok"
          titulo="você está na unidade"
          texto="fique de olho na TV e no celular."
          style={{ marginTop: 8 }}
        />
        {estado.linhas.map((l) => (
          <TextoSuave key={l}>{l}</TextoSuave>
        ))}
        <Espaco />
        <Botao texto="ver minha fila" onPress={verFila} />
      </Tela>
    );

  if (estado.tipo === "fim")
    return (
      <Tela voltar={false}>
        <Faixa
          tipo="aviso"
          grande
          titulo="passe na recepção"
          texto="para confirmar seus documentos. você ainda não entrou na fila da unidade."
          style={{ marginTop: 8 }}
        />
        {estado.linhas.map((l) => (
          <TextoSuave key={l}>{l}</TextoSuave>
        ))}
        <TextoSuave>só na primeira vez. depois disso, é só ler o QR.</TextoSuave>
        <Espaco />
        <Botao texto="ver minha fila" onPress={verFila} />
      </Tela>
    );

  if (estado.tipo === "erro")
    return (
      <Tela voltar={false}>
        <Faixa tipo="perigo" titulo="não deu certo" texto={estado.texto} style={{ marginTop: 8 }} />
        <Espaco />
        <Botao texto="ler de novo" onPress={deNovo} />
        <Botao texto="ver minha fila" tipo="secundario" onPress={verFila} />
      </Tela>
    );

  const enviando = estado.tipo === "enviando" || (!linkUsado.current && Boolean(deParametros(params)));
  return (
    <Tela fundo={COR.primary900} topo={false}>
      <Text style={{ fontFamily: FONTE.extra, fontSize: 28, lineHeight: 34, marginTop: 8, ...branco }}>
        {enviando ? "confirmando sua chegada…" : "aponte para o QR da TV"}
      </Text>
      <Text style={{ fontFamily: FONTE.regular, fontSize: 18, lineHeight: 28, ...branco }}>
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
        {permissao?.granted && !enviando ? (
          <CameraView
            style={{ width: "100%", height: "100%" }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              const qr = lerQr(data);
              if (qr) void enviar(qr);
            }}
          />
        ) : null}
      </View>
      <Espaco />
      {!permissao?.granted ? (
        <Botao texto="permitir a câmera" tipo="branco" onPress={() => void pedirPermissao()} />
      ) : null}
      <LinkBotao texto="não consigo ler" cor="#ffffff" onPress={() => setNaoLe(!naoLe)} />
      {naoLe ? (
        <Text style={{ fontFamily: FONTE.regular, fontSize: 18, lineHeight: 28, textAlign: "center", ...branco }}>
          peça ajuda na recepção. eles marcam a sua presença.
        </Text>
      ) : null}
      <LinkBotao texto="voltar" cor="#ffffff" onPress={() => (router.canGoBack() ? router.back() : verFila())} />
    </Tela>
  );
}
