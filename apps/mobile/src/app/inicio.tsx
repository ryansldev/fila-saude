import { router } from "expo-router";
import { CalendarDays, MapPin } from "lucide-react-native";
import { Text, View } from "react-native";
import { Destaque, FaixaDosAvisos, primeiroNome, SuaVez, useMinhaFila } from "@/components/atendimento";
import {
  Abas,
  Avatar,
  BlocoData,
  Carregando,
  COR,
  Faixa,
  FalaDoDr,
  FONTE,
  LinhaTocavel,
  Pequeno,
  Selo,
  Tela,
} from "@/components/ui";
import { cumprimentoDoDia, hora, partesDoDia } from "@/lib/datas";
import { useSessao } from "@/lib/sessao";

/**
 * Hoje (aba principal): só o que está marcado para a pessoa hoje, um cartão por atendimento.
 * O resto (outros dias, lista de espera, reserva, histórico) fica em "atendimentos".
 */
export default function Hoje() {
  const s = useSessao();
  const f = useMinhaFila();
  if (f.vez) return <SuaVez senha={f.vez.senha} estacao={f.vez.estacao} fechar={f.vez.dispensar} />;

  const deHoje = f.lista.filter((x) => x.resumo.grupo === "hoje");
  const proximo = f.lista
    .filter((x) => x.resumo.grupo === "proximos" && x.en.sessao)
    .sort((a, b) => (a.en.sessao?.inicio ?? "").localeCompare(b.en.sessao?.inicio ?? ""))[0];
  const outros = f.lista.filter((x) => x.resumo.grupo === "proximos" || x.resumo.grupo === "sem_data").length;
  const nome = primeiroNome(s.conta?.nome);
  const fala =
    deHoje.length === 0
      ? proximo
        ? "hoje está livre. o seu próximo atendimento está logo abaixo."
        : "hoje está livre. as unidades perto de você ficam mais embaixo."
      : deHoje.length === 1
        ? "você tem 1 atendimento hoje. eu te aviso a hora de sair de casa."
        : `você tem ${deHoje.length} atendimentos hoje. eu te aviso a hora de sair de casa.`;

  return (
    <Tela voltar={false} rodape={<Abas atual="hoje" />}>
      <FalaDoDr cumprimento={cumprimentoDoDia(Date.now())} nome={nome} texto={fala} />
      {f.erro ? (
        <Faixa
          tipo="perigo"
          titulo={f.erro.titulo}
          texto={f.erro.texto}
          acao={{ texto: "tentar de novo", onPress: () => void f.tentarDeNovo(), carregando: f.tentando }}
        />
      ) : null}
      <FaixaDosAvisos />
      {f.cancelada ? <Faixa tipo="ok" titulo="pronto, inscrição cancelada" texto={f.cancelada} /> : null}
      {f.entradas === null && !f.erro ? <Carregando texto="buscando o seu dia…" /> : null}
      {f.cartoes(deHoje)}
      {deHoje.length === 0 && proximo?.en.sessao ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 18, color: COR.inkMuted, marginBottom: -4 }}>
            próximo atendimento
          </Text>
          <LinhaTocavel
            acao="ver meus atendimentos"
            onPress={() => router.replace("/atendimentos")}
            esquerda={<BlocoData {...partesDoDia(proximo.en.sessao.inicio, Date.now())} tom={proximo.resumo.tom} />}
          >
            <Destaque>{proximo.en.servico.toLowerCase()}</Destaque>
            <Pequeno>
              {hora(proximo.en.sessao.inicio)} às {hora(proximo.en.sessao.fim)} · {proximo.en.unidade}
            </Pequeno>
            <Selo texto={proximo.resumo.selo} tom={proximo.resumo.tom} />
          </LinhaTocavel>
        </View>
      ) : null}
      {deHoje.length > 0 && outros > 0 ? (
        <LinhaTocavel
          acao="ver meus atendimentos"
          onPress={() => router.replace("/atendimentos")}
          esquerda={<Avatar Icone={CalendarDays} />}
        >
          <Text style={{ fontFamily: FONTE.extra, fontSize: 19, lineHeight: 25, color: COR.ink }}>
            {outros === 1 ? "mais 1 atendimento" : `mais ${outros} atendimentos`}
          </Text>
          <Pequeno>em outros dias ou na lista de espera</Pequeno>
        </LinhaTocavel>
      ) : null}
      {/* Sempre visível: a aba "unidades" existe, mas quem está em "hoje" precisa de um caminho óbvio. */}
      <View style={{ gap: 10, marginTop: deHoje.length === 0 && !proximo ? 4 : 8 }}>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 18, color: COR.inkMuted }}>unidades perto de você</Text>
        <LinhaTocavel
          acao="ver as unidades"
          onPress={() => router.replace("/unidades")}
          esquerda={<Avatar Icone={MapPin} tom="verde" />}
        >
          <Text style={{ fontFamily: FONTE.extra, fontSize: 19, lineHeight: 25, color: COR.ink }}>
            ver agenda e se inscrever
          </Text>
          <Pequeno>mapa e lista das unidades do seu município</Pequeno>
        </LinhaTocavel>
      </View>
      {f.gaveta}
    </Tela>
  );
}
