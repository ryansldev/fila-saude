import type { MinhaEntrada, ServicoDaUnidade, SessaoDaAgenda, UnidadePublica } from "@fila-saude/schemas/fila";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Building2, Check, ClipboardList, Clock, MapPin, Navigation, Stethoscope, Ticket } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import {
  Avatar,
  Botao,
  CalendarioDoMes,
  Carregando,
  Cartao,
  COR,
  Faixa,
  FaixaDeDias,
  FONTE,
  Pequeno,
  Pilula,
  Tela,
  Texto,
  TextoSuave,
  Titulo,
  type Tom,
} from "@/components/ui";
import { hora } from "@/lib/datas";
import { chaveDoDia, diasComAtendimento, diaValido, gradeDoMes, mesAno } from "@/lib/dias";
import { inscricaoNaAgenda, type ServicoComLista, servicosComLista } from "@/lib/inscricoes";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro } from "@/lib/textos";
import { linkComoChegar, nomeDoTipo } from "@/lib/unidades";

const vagas = (x: SessaoDaAgenda): { texto: string; tom: Tom } =>
  x.vagasRestantes === null
    ? { texto: "vagas livres", tom: "verde" }
    : x.vagasRestantes === 0
      ? { texto: "sem vagas: entra na reserva", tom: "amarelo" }
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

/** Uma sessão do dia escolhido: o serviço, a situação, o horário e o profissional, e o botão. */
function CartaoDaSessao({ x, unidade, minhas }: { x: SessaoDaAgenda; unidade: string; minhas: MinhaEntrada[] | null }) {
  const situacao = inscricaoNaAgenda(x, minhas);
  const inscrito = situacao.tipo === "inscrito";
  // Dono já no serviço: ainda dá para inscrever outra pessoa (o "para mim" fica desligado
  // na próxima tela). Só sem nada a fazer o botão leva à minha fila.
  const soVer = inscrito && !situacao.podeOutra;
  const v = vagas(x);
  const inscrever = () =>
    router.push({
      pathname: "/inscricao/[sessaoId]",
      params: {
        sessaoId: x.id,
        servicoId: x.servico.id,
        servico: x.servico.nome,
        unidade,
        inicio: x.inicio,
        aberta: x.estado === "aberta" ? "1" : "0",
      },
    });
  return (
    <Cartao style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>
          {x.servico.nome.toLowerCase()}
        </Text>
        {inscrito ? (
          <Pilula texto="você está inscrito" tom="verde" Icone={Check} />
        ) : (
          <Pilula texto={v.texto} tom={v.tom} Icone={Ticket} />
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Clock size={18} color={COR.inkMuted} strokeWidth={2.4} />
          <Pequeno>
            {hora(x.inicio)} às {hora(x.fim)}
          </Pequeno>
        </View>
        {x.profissional ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Stethoscope size={18} color={COR.inkMuted} strokeWidth={2.4} />
            <Pequeno>{x.profissional}</Pequeno>
          </View>
        ) : null}
        {x.estado === "aberta" ? <Pilula texto="fila andando" tom="azul" /> : null}
      </View>
      {soVer ? <Pequeno>sua conta já inscreveu o máximo de pessoas nesta data.</Pequeno> : null}
      <View style={{ alignItems: "flex-end" }}>
        {soVer ? (
          <Botao
            texto="ver minha fila"
            variante="secundario"
            tamanho="medio"
            onPress={() => router.replace("/inicio")}
          />
        ) : inscrito ? (
          <Botao texto="outra pessoa" variante="secundario" tamanho="medio" onPress={inscrever} />
        ) : (
          <Botao texto="quero ir" tamanho="medio" onPress={inscrever} />
        )}
      </View>
    </Cartao>
  );
}

const TEXTO_DO_SERVICO: Record<"requisicao" | "regulado", string> = {
  requisicao: "pede a requisição do médico. leve o papel à recepção.",
  regulado: "marcado pela regulação. procure a sua UBS.",
};

/** T5.1 / I1: um serviço com lista de espera; regulado e requisição só explicam. */
function CartaoDoServico({ x, unidade }: { x: ServicoComLista; unidade: string }) {
  const entra = x.tipo === "entrar" || x.tipo === "na_lista";
  const entrar = () =>
    router.push({
      pathname: "/inscricao/[sessaoId]",
      params: { sessaoId: "lista", servicoId: x.id, servico: x.nome, unidade },
    });
  return (
    <Cartao style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Avatar Icone={ClipboardList} tom={x.tipo === "na_lista" ? "verde" : entra ? "azul" : "cinza"} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 18, lineHeight: 24, color: COR.ink }}>
            {x.nome.toLowerCase()}
          </Text>
          {x.tipo === "na_lista" ? <Pilula texto="na lista" tom="verde" Icone={Check} /> : null}
          {x.tipo === "requisicao" || x.tipo === "regulado" ? <Pequeno>{TEXTO_DO_SERVICO[x.tipo]}</Pequeno> : null}
        </View>
      </View>
      {entra ? (
        <View style={{ alignItems: "flex-end" }}>
          <Botao
            texto={x.tipo === "na_lista" ? "outra pessoa" : "entrar na lista"}
            variante="secundario"
            tamanho="medio"
            onPress={entrar}
          />
        </View>
      ) : null}
    </Cartao>
  );
}

/** Uma unidade: endereço, "como chegar" e os próximos atendimentos abertos para inscrição. */
export default function Unidade() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useSessao();
  const [unidade, setUnidade] = useState<UnidadePublica | "nao_achou" | null>(null);
  const [sessoes, setSessoes] = useState<SessaoDaAgenda[] | null>(null);
  const [servicosDaUnidade, setServicosDaUnidade] = useState<ServicoDaUnidade[] | null>(null);
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
        s.api.get<ServicoDaUnidade[]>(`/v1/municipios/${s.municipio}/unidades/${id}/servicos`),
      ])
        .then(([us, ag, m, sv]) => {
          setServicosDaUnidade(sv);
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
  // A faixa: só os dias com atendimento; o escolhido volta ao primeiro se o dia sumir.
  const dias = useMemo(
    () =>
      diasComAtendimento(
        (sessoes ?? []).map((x) => x.inicio),
        Date.now(),
      ),
    [sessoes],
  );
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const dia = diaValido(escolhido, dias);
  const [calendario, setCalendario] = useState(false);
  const meses = useMemo(() => {
    const com = new Set(dias.map((d) => d.chave));
    const hoje = chaveDoDia(new Date().toISOString());
    return [...new Set(dias.map((d) => d.chave.slice(0, 7)))].map((am) => {
      const [a, m] = am.split("-").map(Number);
      return { titulo: mesAno(`${am}-01`), semanas: gradeDoMes(a ?? 0, m ?? 1, com, hoje) };
    });
  }, [dias]);

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
          <Cartao style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
              <Avatar Icone={Building2} tom={(sessoes?.length ?? 0) > 0 ? "verde" : "cinza"} />
              <View style={{ flex: 1, gap: 4 }}>
                <Titulo>{unidade.nome}</Titulo>
                <Pilula texto={nomeDoTipo(unidade.tipo)} tom="azul" />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <MapPin size={20} color={COR.inkMuted} strokeWidth={2.25} style={{ marginTop: 4 }} />
              <View style={{ flex: 1 }}>
                <Texto style={{ fontFamily: FONTE.bold }}>
                  {unidade.endereco.logradouro}, {unidade.endereco.numero}
                </Texto>
                <TextoSuave>
                  {unidade.endereco.bairro}, CEP {unidade.endereco.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}
                </TextoSuave>
              </View>
            </View>
            <View style={{ alignItems: "flex-start" }}>
              <Botao
                texto="como chegar"
                variante="secundario"
                tamanho="medio"
                icone={Navigation}
                onPress={() => void abrirComoChegar(unidade)}
              />
            </View>
          </Cartao>
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
          {dias.length > 0 ? (
            <>
              <Text style={{ fontFamily: FONTE.extra, fontSize: 22, lineHeight: 28, color: COR.ink, marginTop: 8 }}>
                escolha o dia
              </Text>
              <FaixaDeDias dias={dias} atual={dia} mudar={setEscolhido} aoAbrirCalendario={() => setCalendario(true)} />
              {(sessoes ?? [])
                .filter((x) => chaveDoDia(x.inicio) === dia)
                .map((x) => (
                  <CartaoDaSessao key={x.id} x={x} unidade={unidade.nome} minhas={minhas} />
                ))}
            </>
          ) : null}
          {servicosDaUnidade && servicosDaUnidade.length > 0 ? (
            <>
              <Text style={{ fontFamily: FONTE.extra, fontSize: 22, lineHeight: 28, color: COR.ink, marginTop: 8 }}>
                lista de espera
              </Text>
              <TextoSuave style={{ marginTop: -8 }}>a unidade marca a data e avisa no app.</TextoSuave>
              {servicosComLista(servicosDaUnidade, minhas).map((x) => (
                <CartaoDoServico key={x.id} x={x} unidade={unidade.nome} />
              ))}
            </>
          ) : null}
        </>
      ) : null}
      <CalendarioDoMes
        aberta={calendario}
        fechar={() => setCalendario(false)}
        meses={meses}
        atual={dia}
        aoEscolher={setEscolhido}
      />
    </Tela>
  );
}
