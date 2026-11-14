import { router } from "expo-router";
import { View } from "react-native";
import { contexto, Destaque, FaixaDosAvisos, primeiroNome, SuaVez, useMinhaFila } from "@/components/atendimento";
import {
  Abas,
  Botao,
  Carregando,
  Cartao,
  CartaoTocavel,
  Faixa,
  Mascote,
  Pequeno,
  Tela,
  TextoSuave,
  Titulo,
} from "@/components/ui";
import { diaCurto } from "@/lib/datas";
import { useSessao } from "@/lib/sessao";

const hojePorExtenso = () => diaCurto(new Date().toISOString());

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

  return (
    <Tela voltar={false} rodape={<Abas atual="hoje" />}>
      <View style={{ gap: 2 }}>
        <TextoSuave>
          {s.conta ? `olá, ${primeiroNome(s.conta.nome)} · ` : ""}
          {hojePorExtenso()}
        </TextoSuave>
        <Titulo>hoje</Titulo>
      </View>
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
      {f.entradas !== null && deHoje.length === 0 ? (
        <Cartao style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Mascote tamanho={120} />
          <Destaque>nada marcado para hoje</Destaque>
          <TextoSuave style={{ textAlign: "center" }}>
            {proximo
              ? "o seu próximo atendimento está logo abaixo."
              : "quando você se inscrever num atendimento, ele aparece aqui no dia."}
          </TextoSuave>
          {!proximo ? (
            <View style={{ alignSelf: "stretch" }}>
              <Botao texto="procurar uma unidade" onPress={() => router.replace("/unidades")} />
            </View>
          ) : null}
        </Cartao>
      ) : null}
      {f.cartoes(deHoje)}
      {deHoje.length === 0 && proximo ? (
        <CartaoTocavel acao="ver meus atendimentos" onPress={() => router.replace("/atendimentos")}>
          <Pequeno>próximo atendimento</Pequeno>
          <Destaque>{proximo.en.sessao ? diaCurto(proximo.en.sessao.inicio) : ""}</Destaque>
          <TextoSuave>{contexto(proximo.en)}</TextoSuave>
        </CartaoTocavel>
      ) : null}
      {deHoje.length > 0 && outros > 0 ? (
        <CartaoTocavel acao="ver meus atendimentos" onPress={() => router.replace("/atendimentos")}>
          <TextoSuave>
            {outros === 1 ? "você tem mais 1 atendimento" : `você tem mais ${outros} atendimentos`} em outros dias ou na
            lista de espera.
          </TextoSuave>
        </CartaoTocavel>
      ) : null}
      {f.gaveta}
    </Tela>
  );
}
