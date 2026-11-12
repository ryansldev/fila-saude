import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { Erro, e, Opcao, Tela } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

type Municipio = { slug: string; nome: string; uf: string | null };

/** AD-028: um app só; a pessoa escolhe o município. */
export default function EscolherMunicipio() {
  const s = useSessao();
  const [lista, setLista] = useState<Municipio[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    s.api
      .get<Municipio[]>("/v1/municipios")
      .then(setLista)
      .catch((err) => setErro(mensagemDoErro(err)));
  }, [s.api]);

  return (
    <Tela titulo="Qual é o seu município?">
      <Erro texto={erro} />
      {lista.map((m) => (
        <Opcao
          key={m.slug}
          texto={m.uf ? `${m.nome} - ${m.uf}` : m.nome}
          marcada={s.municipio === m.slug}
          onPress={async () => {
            await s.escolherMunicipio(m.slug);
            router.replace("/inicio");
          }}
        />
      ))}
      {lista.length === 0 && !erro ? <Text style={e.suave}>Carregando...</Text> : null}
    </Tela>
  );
}
