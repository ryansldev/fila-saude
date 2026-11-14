import type { MinhaEntrada, SessaoDaAgenda, UnidadePublica } from "@fila-saude/schemas/fila";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import {
  Botao,
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
import { enderecoEmLinha, linkComoChegar, nomeDoTipo } from "@/lib/unidades";

const vagas = (x: SessaoDaAgenda) =>
  x.vagasRestantes === null
    ? "vagas livres"
    : x.vagasRestantes === 0
      ? "as vagas acabaram · você entra na reserva"
      : x.vagasRestantes === 1
        ? "1 vaga"
        : `${x.vagasRestantes} vagas`;

async function abrirComoChegar(u: UnidadePublica) {
  const link = linkComoChegar(u, Platform.OS);
  try {
    await Linking.openURL(link);
  } catch {
    // Sem app de mapas que entenda o geo: abre o Google Maps no navegador.
    await Linking.openURL(linkComoChegar(u, "web")).catch(() => undefined);
  }
}

/** Uma sessão da unidade, com o selo de quem já está inscrito (AD-032), como era na agenda. */
function CartaoDaSessao({ x, unidade, minhas }: { x: SessaoDaAgenda; unidade: string; minhas: MinhaEntrada[] | null }) {
  const situacao = inscricaoNaAgenda(x, minhas);
  const inscrito = situacao.tipo === "inscrito";
  // Dono já no serviço: ainda dá para inscrever outra pessoa (o "para mim" fica desligado
  // na próxima tela). Só sem nada a fazer o cartão leva à minha fila.
  const soVer = inscrito && !situacao.podeOutra;
  return (
    <CartaoTocavel
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
                unidade,
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
}

/** Uma unidade: endereço, "como chegar" e os próximos atendimentos abertos para inscrição. */
export default function Unidade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useSessao();
  const [unidade, setUnidade] = useState<UnidadePublica | "nao_achou" | null>(null);
  const [sessoes, setSessoes] = useState<SessaoDaAgenda[] | null>(null);
  // AD-032: as inscrições da conta, para não oferecer de novo um serviço em que a pessoa já está.
  const [minhas, setMinhas] = useState<MinhaEntrada[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [tentando, setTentando] = useState(false);

  const buscar = useCallback(
    () =>
      Promise.all([
        s.api.get<UnidadePublica[]>(`/v1/municipios/${s.municipio}/unidades`),
        s.api.get<SessaoDaAgenda[]>(`/v1/municipios/${s.municipio}/agenda`),
        s.api.get<MinhaEntrada[]>(`/v1/municipios/${s.municipio}/minhas`),
      ])
        .then(([us, ag, m]) => {
          setUnidade(us.find((u) => u.id === id) ?? "nao_achou");
          setSessoes(ag.filter((x) => x.unidade.id === id).sort((a, b) => a.inicio.localeCompare(b.inicio)));
          setMinhas(m);
          setErro(null);
        })
        .catch((err) => setErro(avisoDoErro(err, "confira a conexão e tente de novo."))),
    [s.api, s.municipio, id],
  );
  // Volta depois de se inscrever: busca de novo, para o cartão já dizer "inscrito".
  useFocusEffect(
    useCallback(() => {
      void buscar();
    }, [buscar]),
  );

  const voltar = () => (router.canGoBack() ? router.back() : router.replace("/unidades"));

  if (unidade === "nao_achou")
    return (
      <Tela aoVoltar={voltar} acoes={<Botao texto="ver as unidades" onPress={() => router.replace("/unidades")} />}>
        <Faixa
          tipo="aviso"
          titulo="unidade não encontrada"
          texto="ela pode ter saído do app. veja a lista de unidades do seu município."
        />
      </Tela>
    );

  return (
    <Tela aoVoltar={voltar}>
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
      {unidade === null && !erro ? <Carregando texto="buscando a unidade…" /> : null}
      {unidade ? (
        <>
          <View style={{ gap: 6 }}>
            <Pequeno>{nomeDoTipo(unidade.tipo)}</Pequeno>
            <Titulo>{unidade.nome}</Titulo>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <MapPin size={22} color={COR.inkMuted} strokeWidth={2.25} style={{ marginTop: 3 }} />
              <TextoSuave style={{ flex: 1 }}>{enderecoEmLinha(unidade.endereco)}</TextoSuave>
            </View>
          </View>
          <Botao texto="como chegar" tipo="secundario" onPress={() => void abrirComoChegar(unidade)} />
          <Text style={{ fontFamily: FONTE.extra, fontSize: 22, lineHeight: 28, color: COR.ink, marginTop: 8 }}>
            próximos atendimentos
          </Text>
          {sessoes?.length === 0 ? (
            <View style={{ gap: 4, paddingVertical: 16 }}>
              <Texto style={{ fontFamily: FONTE.bold, textAlign: "center" }}>
                nenhum atendimento aberto para inscrição agora nesta unidade
              </Texto>
              <TextoSuave style={{ textAlign: "center" }}>
                novas datas aparecem aqui quando a unidade abre as inscrições.
              </TextoSuave>
            </View>
          ) : null}
          {(sessoes ?? []).map((x) => (
            <CartaoDaSessao key={x.id} x={x} unidade={unidade.nome} minhas={minhas} />
          ))}
        </>
      ) : null}
    </Tela>
  );
}
