import type { SessaoDaAgenda } from "@fila-saude/schemas/fila";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Abas, Carregando, CartaoTocavel, COR, Faixa, FONTE, Pequeno, Tela, Texto, Titulo } from "@/components/ui";
import { diaCurto, hora } from "@/lib/datas";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro } from "@/lib/textos";

const vagas = (x: SessaoDaAgenda) =>
  x.vagasRestantes === null
    ? "vagas livres"
    : x.vagasRestantes === 0
      ? "as vagas acabaram · você entra na reserva"
      : `${x.vagasRestantes} vagas`;

/** T3.2: agenda pública do município, por unidade; só dados da sessão. */
export default function Agenda() {
  const s = useSessao();
  const [lista, setLista] = useState<SessaoDaAgenda[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [tentando, setTentando] = useState(false);

  const buscar = useCallback(
    () =>
      s.api
        .get<SessaoDaAgenda[]>(`/v1/municipios/${s.municipio}/agenda`)
        .then((l) => {
          setLista(l);
          setErro(null);
        })
        .catch((err) => setErro(avisoDoErro(err, "confira a conexão e tente de novo."))),
    [s.api, s.municipio],
  );
  useEffect(() => {
    void buscar();
  }, [buscar]);

  const unidades = [...new Map((lista ?? []).map((x) => [x.unidade.id, x.unidade])).values()];

  return (
    <Tela voltar={false} rodape={<Abas atual="unidades" />}>
      <Titulo>próximos atendimentos</Titulo>
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
      {lista === null && !erro ? <Carregando texto="buscando os atendimentos…" /> : null}
      {lista?.length === 0 ? <Texto>nenhum atendimento aberto para inscrição agora.</Texto> : null}
      {unidades.map((u) => (
        <View key={u.id} style={{ gap: 12 }}>
          <View>
            <Text style={{ fontFamily: FONTE.bold, fontSize: 22, lineHeight: 28, color: COR.ink }}>{u.nome}</Text>
            <Pequeno>{u.bairro}</Pequeno>
          </View>
          {(lista ?? [])
            .filter((x) => x.unidade.id === u.id)
            .map((x) => (
              <CartaoTocavel
                key={x.id}
                acao="quero ir"
                onPress={() =>
                  router.push({
                    pathname: "/inscricao/[sessaoId]",
                    params: {
                      sessaoId: x.id,
                      servico: x.servico.nome,
                      unidade: u.nome,
                      inicio: x.inicio,
                      aberta: x.estado === "aberta" ? "1" : "0",
                    },
                  })
                }
              >
                <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>
                  {diaCurto(x.inicio)} · {hora(x.inicio)} às {hora(x.fim)}
                </Text>
                <Texto>{x.servico.nome.toLowerCase()}</Texto>
                <Pequeno>
                  {x.estado === "aberta" ? "fila andando · " : ""}
                  {vagas(x)}
                  {x.profissional ? ` · ${x.profissional}` : ""}
                </Pequeno>
              </CartaoTocavel>
            ))}
        </View>
      ))}
      {lista && lista.length > 0 ? (
        <Pequeno style={{ textAlign: "center" }}>a lista mostra as unidades do seu município.</Pequeno>
      ) : null}
    </Tela>
  );
}
