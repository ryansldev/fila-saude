import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import { Carregando } from "@/components/ui";
import { ler } from "@/lib/armazenamento";
import { CHAVE_ONBOARDING, destinoSemConta } from "@/lib/onboarding";
import { useSessao } from "@/lib/sessao";

/**
 * Sem conta → boas-vindas (ou entrar, se já viu o "conhecer o app"); avisos nunca perguntados → explicar;
 * sem município → escolher; senão, minha fila.
 */
export default function Inicio() {
  const s = useSessao();
  const semConta = s.pronto && s.avisos !== null && !s.token;
  const [visto, setVisto] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (semConta) void ler(CHAVE_ONBOARDING).then((v) => setVisto(v ?? null));
  }, [semConta]);

  useEffect(() => {
    if (!semConta || visto === undefined) return;
    const [primeira, ...resto] = destinoSemConta(visto);
    if (primeira) router.replace(primeira);
    for (const rota of resto) router.push(rota);
  }, [semConta, visto]);

  if (!s.pronto || s.avisos === null || semConta) return <Carregando cheia />;
  if (s.avisos.tipo === "perguntar" && !s.avisosExplicados) return <Redirect href="/avisos" />;
  if (!s.municipio) return <Redirect href="/municipio" />;
  return <Redirect href="/inicio" />;
}
