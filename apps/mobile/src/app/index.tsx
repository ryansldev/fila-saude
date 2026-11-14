import { Redirect } from "expo-router";
import { Carregando } from "@/components/ui";
import { useSessao } from "@/lib/sessao";

/** Sem conta → boas-vindas; avisos nunca perguntados → explicar; sem município → escolher; senão, minha fila. */
export default function Inicio() {
  const s = useSessao();
  if (!s.pronto || s.avisos === null) return <Carregando cheia />;
  if (!s.token) return <Redirect href="/boas-vindas" />;
  if (s.avisos.tipo === "perguntar" && !s.avisosExplicados) return <Redirect href="/avisos" />;
  if (!s.municipio) return <Redirect href="/municipio" />;
  return <Redirect href="/inicio" />;
}
