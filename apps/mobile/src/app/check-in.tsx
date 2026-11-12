import type { CheckIn } from "@fila-saude/schemas/fila";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Botao, COR, Erro, e, Tela } from "@/components/ui";
import { deParametros, lerQr, type QrLido, textoDoCheckIn } from "@/lib/check-in";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

type Estado =
  | { tipo: "lendo" }
  | { tipo: "enviando" }
  | { tipo: "fim"; ok: boolean; linhas: string[] }
  | { tipo: "erro"; texto: string };

/**
 * RN-PRES-01: "Cheguei". Abre pelo link do QR (câmera do celular) ou pelo leitor do app.
 * Sem conta, o índice manda entrar primeiro.
 */
export default function CheckInPeloQr() {
  const params = useLocalSearchParams<{ m?: string; u?: string; t?: string }>();
  const s = useSessao();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const [estado, setEstado] = useState<Estado>({ tipo: "lendo" });
  const lido = useRef(false);

  const enviar = useCallback(
    async (qr: QrLido) => {
      if (lido.current) return;
      lido.current = true;
      setEstado({ tipo: "enviando" });
      try {
        if (s.municipio !== qr.municipio) await s.escolherMunicipio(qr.municipio);
        const r = await s.api.post<CheckIn>(`/v1/municipios/${qr.municipio}/check-in`, {
          unidadeId: qr.unidadeId,
          tokens: qr.tokens,
        });
        setEstado({ tipo: "fim", ...textoDoCheckIn(r) });
      } catch (err) {
        setEstado({ tipo: "erro", texto: mensagemDoErro(err) });
      }
    },
    [s],
  );

  useEffect(() => {
    if (!s.pronto) return;
    if (!s.token) {
      router.replace("/entrar");
      return;
    }
    const doLink = deParametros(params);
    if (doLink) void enviar(doLink);
  }, [s.pronto, s.token, params, enviar]);

  const deNovo = () => {
    lido.current = false;
    setEstado({ tipo: "lendo" });
  };

  if (estado.tipo === "fim" || estado.tipo === "erro") {
    const ok = estado.tipo === "fim" && estado.ok;
    return (
      <Tela titulo={ok ? "Você chegou!" : estado.tipo === "erro" ? "Não deu certo" : "Passe na recepção"}>
        {estado.tipo === "fim" ? (
          estado.linhas.map((l) => (
            <Text key={l} style={[e.texto, { color: ok ? COR.sucesso : COR.alerta }]}>
              {l}
            </Text>
          ))
        ) : (
          <Erro texto={estado.texto} />
        )}
        <Botao texto="Ver minha vez" onPress={() => router.replace("/inicio")} />
        {estado.tipo === "erro" ? <Botao texto="Ler de novo" tipo="secundario" onPress={deNovo} /> : null}
      </Tela>
    );
  }

  if (estado.tipo === "enviando" || deParametros(params))
    return (
      <Tela titulo="Confirmando sua chegada...">
        <Text style={e.suave}>Um instante.</Text>
      </Tela>
    );

  if (!permissao?.granted)
    return (
      <Tela titulo="Cheguei na unidade">
        <Text style={e.texto}>Para entrar na fila da unidade, leia o QR que está na recepção ou na TV.</Text>
        <Botao texto="Permitir a câmera" onPress={() => void pedirPermissao()} />
      </Tela>
    );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => {
          const qr = lerQr(data);
          if (qr) void enviar(qr);
        }}
      />
      <View style={{ position: "absolute", bottom: 48, left: 20, right: 20, gap: 12 }}>
        <Text style={{ color: "#fff", fontSize: 18, textAlign: "center" }}>Aponte para o QR de entrada da unidade</Text>
        <Botao texto="Cancelar" tipo="secundario" onPress={() => router.back()} />
      </View>
    </View>
  );
}
