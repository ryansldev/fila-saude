import type { SessaoDaAgenda } from "@fila-saude/schemas/fila";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Abas, Botao, Cartao, COR, Faixa, FONTE, Pequeno, Tela, Texto, Titulo } from "@/components/ui";
import { diaCurto, hora } from "@/lib/datas";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

const vagas = (x: SessaoDaAgenda) =>
  x.vagasRestantes === null
    ? "vagas livres · inscrição pelo app"
    : x.vagasRestantes === 0
      ? "as vagas acabaram · você entra na reserva"
      : `${x.vagasRestantes} vagas · inscrição pelo app`;

/** T3.2: agenda pública do município, por unidade; só dados da sessão. */
export default function Agenda() {
  const s = useSessao();
  const [lista, setLista] = useState<SessaoDaAgenda[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    s.api
      .get<SessaoDaAgenda[]>(`/v1/municipios/${s.municipio}/agenda`)
      .then(setLista)
      .catch((err) => setErro(mensagemDoErro(err)));
  }, [s.api, s.municipio]);

  const unidades = [...new Map((lista ?? []).map((x) => [x.unidade.id, x.unidade])).values()];

  return (
    <Tela voltar={false} rodape={<Abas atual="unidades" />}>
      <Titulo>próximos atendimentos</Titulo>
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
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
              <Cartao key={x.id}>
                <Text style={{ fontFamily: FONTE.extra, fontSize: 20, color: COR.ink }}>
                  {diaCurto(x.inicio)} · {hora(x.inicio)} às {hora(x.fim)}
                </Text>
                <Texto>{x.servico.nome.toLowerCase()}</Texto>
                <Pequeno>
                  {x.estado === "aberta" ? "fila andando · " : ""}
                  {vagas(x)}
                  {x.profissional ? ` · ${x.profissional}` : ""}
                </Pequeno>
                <View style={{ marginTop: 8 }}>
                  <Botao
                    texto="quero ir"
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
                  />
                </View>
              </Cartao>
            ))}
        </View>
      ))}
      <Pequeno style={{ textAlign: "center" }}>a lista mostra as unidades do seu município.</Pequeno>
    </Tela>
  );
}
