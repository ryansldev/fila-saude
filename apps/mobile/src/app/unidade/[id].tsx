import type { MinhaEntrada, SessaoDaAgenda, UnidadePublica } from "@fila-saude/schemas/fila";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Building2, MapPin } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import {
  Avatar,
  BlocoData,
  Botao,
  Carregando,
  Chips,
  COR,
  Faixa,
  FONTE,
  LinhaTocavel,
  Pequeno,
  Selo,
  Tela,
  Texto,
  TextoSuave,
  Titulo,
  type Tom,
} from "@/components/ui";
import { hora, partesDoDia } from "@/lib/datas";
import { inscricaoNaAgenda } from "@/lib/inscricoes";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro } from "@/lib/textos";
import { enderecoEmLinha, linkComoChegar, nomeDoTipo } from "@/lib/unidades";

const vagas = (x: SessaoDaAgenda): { texto: string; tom: Tom } =>
  x.vagasRestantes === null
    ? { texto: "vagas livres", tom: "verde" }
    : x.vagasRestantes === 0
      ? { texto: "sem vagas · entra na reserva", tom: "amarelo" }
      : { texto: x.vagasRestantes === 1 ? "1 vaga" : `${x.vagasRestantes} vagas`, tom: "verde" };

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
  const v = vagas(x);
  return (
    <LinhaTocavel
      acao={soVer ? "ver minha fila" : inscrito ? "inscrever outra pessoa" : "quero ir"}
      esquerda={<BlocoData {...partesDoDia(x.inicio, Date.now())} tom={inscrito ? "verde" : "azul"} />}
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
      <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>
        {x.servico.nome.toLowerCase()}
      </Text>
      <Pequeno>
        {hora(x.inicio)} às {hora(x.fim)}
        {x.profissional ? ` · ${x.profissional}` : ""}
        {x.estado === "aberta" ? " · fila andando" : ""}
      </Pequeno>
      {inscrito ? <Selo texto={situacao.selo} tom="verde" /> : <Selo texto={v.texto} tom={v.tom} />}
      {inscrito ? (
        <Pequeno>
          {soVer ? "sua conta já inscreveu o máximo de pessoas nesta data." : "toque para inscrever outra pessoa."}
        </Pequeno>
      ) : null}
    </LinhaTocavel>
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
  const [filtro, setFiltro] = useState<string>("todos");
  const servicos = [...new Map((sessoes ?? []).map((x) => [x.servico.id, x.servico.nome.toLowerCase()]))].map(
    ([id, rotulo]) => ({ id, rotulo }),
  );

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
          <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
            <Avatar Icone={Building2} tom={(sessoes?.length ?? 0) > 0 ? "verde" : "cinza"} />
            <View style={{ flex: 1, gap: 2 }}>
              <Titulo>{unidade.nome}</Titulo>
              <Pequeno>
                {nomeDoTipo(unidade.tipo)} · {unidade.endereco.bairro}
              </Pequeno>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <MapPin size={22} color={COR.inkMuted} strokeWidth={2.25} style={{ marginTop: 3 }} />
            <TextoSuave style={{ flex: 1 }}>{enderecoEmLinha(unidade.endereco)}</TextoSuave>
          </View>
          <Botao texto="como chegar" tipo="secundario" onPress={() => void abrirComoChegar(unidade)} />
          <Text style={{ fontFamily: FONTE.extra, fontSize: 22, lineHeight: 28, color: COR.ink, marginTop: 8 }}>
            próximos atendimentos
          </Text>
          {servicos.length > 1 ? (
            <Chips opcoes={[{ id: "todos", rotulo: "todos" }, ...servicos]} atual={filtro} mudar={setFiltro} />
          ) : null}
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
          {(sessoes ?? [])
            .filter((x) => filtro === "todos" || x.servico.id === filtro)
            .map((x) => (
              <CartaoDaSessao key={x.id} x={x} unidade={unidade.nome} minhas={minhas} />
            ))}
        </>
      ) : null}
    </Tela>
  );
}
