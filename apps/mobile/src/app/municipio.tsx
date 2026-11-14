import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { Carregando, CartaoTocavel, COR, Faixa, FONTE, Tela, Titulo } from "@/components/ui";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro } from "@/lib/textos";

type Municipio = { slug: string; nome: string; uf: string | null };

/** AD-028: um app só; a pessoa escolhe o município. */
export default function EscolherMunicipio() {
  const s = useSessao();
  const [lista, setLista] = useState<Municipio[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [tentando, setTentando] = useState(false);

  const buscar = useCallback(
    () =>
      s.api
        .get<Municipio[]>("/v1/municipios")
        .then((l) => {
          setLista(l);
          setErro(null);
        })
        .catch((err) => setErro(avisoDoErro(err, "confira a conexão e tente de novo."))),
    [s.api],
  );
  useEffect(() => {
    void buscar();
  }, [buscar]);

  return (
    <Tela voltar={Boolean(s.municipio)}>
      <Titulo>qual é o seu município?</Titulo>
      {erro ? (
        <Faixa
          tipo="perigo"
          titulo={erro.titulo}
          texto={erro.texto}
          acao={{
            texto: "tentar de novo",
            carregando: tentando,
            onPress: async () => {
              setTentando(true);
              await buscar();
              setTentando(false);
            },
          }}
        />
      ) : null}
      {lista === null && !erro ? <Carregando texto="buscando os municípios…" /> : null}
      {lista?.map((m) => (
        <CartaoTocavel
          key={m.slug}
          acao="escolher"
          onPress={async () => {
            await s.escolherMunicipio(m.slug);
            router.replace("/inicio");
          }}
        >
          <Text style={{ fontFamily: FONTE.bold, fontSize: 22, lineHeight: 28, color: COR.ink }}>
            {m.uf ? `${m.nome} - ${m.uf}` : m.nome}
          </Text>
        </CartaoTocavel>
      ))}
    </Tela>
  );
}
