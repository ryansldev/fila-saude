import type { MinhaEntrada, SessaoDaAgenda } from "@fila-saude/schemas/fila";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import {
  Abas,
  Carregando,
  CartaoTocavel,
  COR,
  Faixa,
  FONTE,
  Pequeno,
  Selo,
  Tela,
  Texto,
  TextoSuave,
  Titulo,
} from "@/components/ui";
import { diaCurto, hora } from "@/lib/datas";
import { inscricaoNaAgenda } from "@/lib/inscricoes";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro } from "@/lib/textos";

const vagas = (x: SessaoDaAgenda) =>
  x.vagasRestantes === null
    ? "vagas livres"
    : x.vagasRestantes === 0
      ? "as vagas acabaram · você entra na reserva"
      : x.vagasRestantes === 1
        ? "1 vaga"
        : `${x.vagasRestantes} vagas`;

/** T3.2: agenda pública do município, por unidade; só dados da sessão. */
export default function Agenda() {
  const s = useSessao();
  const [lista, setLista] = useState<SessaoDaAgenda[] | null>(null);
  // AD-032: as inscrições da conta, para não oferecer de novo um serviço em que a pessoa já está.
  const [minhas, setMinhas] = useState<MinhaEntrada[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [tentando, setTentando] = useState(false);

  const buscar = useCallback(
    () =>
      Promise.all([
        s.api.get<SessaoDaAgenda[]>(`/v1/municipios/${s.municipio}/agenda`),
        s.api.get<MinhaEntrada[]>(`/v1/municipios/${s.municipio}/minhas`),
      ])
        .then(([l, m]) => {
          setLista(l);
          setMinhas(m);
          setErro(null);
        })
        .catch((err) => setErro(avisoDoErro(err, "confira a conexão e tente de novo."))),
    [s.api, s.municipio],
  );
  // Volta à aba depois de se inscrever: busca de novo, para o cartão já dizer "inscrito".
  useFocusEffect(
    useCallback(() => {
      void buscar();
    }, [buscar]),
  );

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
      {lista?.length === 0 ? (
        <View style={{ gap: 4, paddingVertical: 24 }}>
          <Texto style={{ fontFamily: FONTE.bold, textAlign: "center" }}>nenhum atendimento aberto agora</Texto>
          <TextoSuave style={{ textAlign: "center" }}>
            novas datas aparecem aqui quando a unidade abre as inscrições.
          </TextoSuave>
        </View>
      ) : null}
      {unidades.map((u) => (
        <View key={u.id} style={{ gap: 12 }}>
          <View>
            <Text style={{ fontFamily: FONTE.bold, fontSize: 22, lineHeight: 28, color: COR.ink }}>{u.nome}</Text>
            <Pequeno>{u.bairro}</Pequeno>
          </View>
          {(lista ?? [])
            .filter((x) => x.unidade.id === u.id)
            .map((x) => {
              const situacao = inscricaoNaAgenda(x, minhas);
              const inscrito = situacao.tipo === "inscrito";
              // Dono já no serviço: ainda dá para inscrever outra pessoa (o "para mim" fica desligado
              // na próxima tela). Só sem nada a fazer o cartão leva à minha fila.
              const soVer = inscrito && !situacao.podeOutra;
              return (
                <CartaoTocavel
                  key={x.id}
                  acao={soVer ? "ver minha fila" : inscrito ? "inscrever outra pessoa" : "quero ir"}
                  onPress={() =>
                    soVer
                      ? router.replace("/inicio")
                      : router.push({
                          pathname: "/inscricao/[sessaoId]",
                          params: {
                            sessaoId: x.id,
                            servicoId: x.servico.id,
                            servico: x.servico.nome,
                            unidade: u.nome,
                            inicio: x.inicio,
                            aberta: x.estado === "aberta" ? "1" : "0",
                          },
                        })
                  }
                >
                  {inscrito ? <Selo texto={situacao.selo} tom="verde" /> : null}
                  <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>
                    {diaCurto(x.inicio)} · {hora(x.inicio)} às {hora(x.fim)}
                  </Text>
                  <Texto>{x.servico.nome.toLowerCase()}</Texto>
                  <Pequeno>
                    {inscrito
                      ? soVer
                        ? "sua conta já inscreveu o máximo de pessoas nesta data."
                        : "cada pessoa entra uma vez por serviço. sua inscrição está em minha fila."
                      : `${x.estado === "aberta" ? "fila andando · " : ""}${vagas(x)}${x.profissional ? ` · ${x.profissional}` : ""}`}
                  </Pequeno>
                </CartaoTocavel>
              );
            })}
        </View>
      ))}
      {lista && lista.length > 0 ? (
        <Pequeno style={{ textAlign: "center" }}>a lista mostra as unidades do seu município.</Pequeno>
      ) : null}
    </Tela>
  );
}
