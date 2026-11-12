import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export const COR = {
  primaria: "#0b7fc0",
  primariaClara: "#e6f4fb",
  texto: "#1f2937",
  suave: "#6b7280",
  borda: "#d1d5db",
  erro: "#b91c1c",
  sucesso: "#15803d",
  alerta: "#c2410c",
  fundo: "#ffffff",
};

export function Tela({ titulo, children }: { titulo?: string; children: ReactNode }) {
  return (
    <SafeAreaView style={e.tela} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={e.conteudo} keyboardShouldPersistTaps="handled">
        {titulo ? <Text style={e.titulo}>{titulo}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Botao({
  texto,
  onPress,
  tipo = "primario",
  carregando = false,
  desativado = false,
}: {
  texto: string;
  onPress: () => void;
  tipo?: "primario" | "secundario" | "perigo";
  carregando?: boolean;
  desativado?: boolean;
}) {
  const fundo = tipo === "primario" ? COR.primaria : tipo === "perigo" ? COR.erro : COR.fundo;
  const cor = tipo === "secundario" ? COR.primaria : "#fff";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desativado || carregando}
      onPress={onPress}
      style={({ pressed }) => [
        e.botao,
        { backgroundColor: fundo, opacity: desativado ? 0.5 : pressed ? 0.85 : 1 },
        tipo === "secundario" && { borderWidth: 1, borderColor: COR.primaria },
      ]}
    >
      {carregando ? <ActivityIndicator color={cor} /> : <Text style={[e.textoBotao, { color: cor }]}>{texto}</Text>}
    </Pressable>
  );
}

export function Campo({ rotulo, ...props }: { rotulo: string } & TextInputProps) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={e.rotulo}>{rotulo}</Text>
      <TextInput placeholderTextColor={COR.suave} style={e.campo} {...props} />
    </View>
  );
}

export function Erro({ texto }: { texto: string | null }) {
  return texto ? <Text style={e.erro}>{texto}</Text> : null;
}

/** Opção de toque grande (questionário e listas). */
export function Opcao({ texto, marcada, onPress }: { texto: string; marcada: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: marcada }}
      onPress={onPress}
      style={[e.opcao, marcada && { borderColor: COR.primaria, backgroundColor: COR.primariaClara }]}
    >
      <Text style={[e.textoOpcao, marcada && { color: COR.primaria, fontWeight: "600" }]}>{texto}</Text>
    </Pressable>
  );
}

export const e = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { padding: 20, gap: 14 },
  titulo: { fontSize: 26, fontWeight: "700", color: COR.texto, marginBottom: 4 },
  texto: { fontSize: 17, color: COR.texto, lineHeight: 24 },
  suave: { fontSize: 15, color: COR.suave },
  rotulo: { fontSize: 15, fontWeight: "600", color: COR.texto },
  campo: {
    borderWidth: 1,
    borderColor: COR.borda,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 17,
    color: COR.texto,
  },
  botao: { borderRadius: 12, paddingVertical: 15, alignItems: "center", minHeight: 52, justifyContent: "center" },
  textoBotao: { fontSize: 17, fontWeight: "700" },
  erro: { color: COR.erro, fontSize: 15 },
  opcao: { borderWidth: 1, borderColor: COR.borda, borderRadius: 12, padding: 16 },
  textoOpcao: { fontSize: 17, color: COR.texto },
  cartao: { borderWidth: 1, borderColor: COR.borda, borderRadius: 14, padding: 16, gap: 6 },
});
