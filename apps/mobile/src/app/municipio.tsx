import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { COR, e, Faixa, FONTE, Pequeno, Tela, Titulo } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

type Municipio = { slug: string; nome: string; uf: string | null };

/** AD-028: um app só; a pessoa escolhe o município. */
export default function EscolherMunicipio() {
  const s = useSessao();
  const [lista, setLista] = useState<Municipio[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    s.api
      .get<Municipio[]>("/v1/municipios")
      .then(setLista)
      .catch((err) => setErro(mensagemDoErro(err)));
  }, [s.api]);

  return (
    <Tela voltar={Boolean(s.municipio)}>
      <Titulo>qual é o seu município?</Titulo>
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
      {lista === null && !erro ? <Pequeno>carregando…</Pequeno> : null}
      {lista?.map((m) => (
        <Pressable
          key={m.slug}
          accessibilityRole="button"
          style={({ pressed }) => [e.card, pressed && { backgroundColor: COR.primary50 }]}
          onPress={async () => {
            await s.escolherMunicipio(m.slug);
            router.replace("/inicio");
          }}
        >
          <Text style={{ fontFamily: FONTE.bold, fontSize: 22, lineHeight: 28, color: COR.ink }}>
            {m.uf ? `${m.nome} - ${m.uf}` : m.nome}
          </Text>
          <Text style={{ fontFamily: FONTE.bold, fontSize: 16, color: COR.actionPressed }}>ver agenda ›</Text>
        </Pressable>
      ))}
    </Tela>
  );
}
