import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSessao } from "@/lib/sessao";

/** Sem conta → entrar; sem município → escolher; senão, a tela da vez. */
export default function Inicio() {
  const s = useSessao();
  if (!s.pronto)
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  if (!s.token) return <Redirect href="/entrar" />;
  if (!s.municipio) return <Redirect href="/municipio" />;
  return <Redirect href="/inicio" />;
}
