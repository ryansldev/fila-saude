import { Redirect } from "expo-router";
import { View } from "react-native";
import { useSessao } from "@/lib/sessao";

/** Sem conta → boas-vindas; sem município → escolher; senão, minha fila. */
export default function Inicio() {
  const s = useSessao();
  if (!s.pronto) return <View style={{ flex: 1, backgroundColor: "#ffffff" }} />;
  if (!s.token) return <Redirect href="/boas-vindas" />;
  if (!s.municipio) return <Redirect href="/municipio" />;
  return <Redirect href="/inicio" />;
}
