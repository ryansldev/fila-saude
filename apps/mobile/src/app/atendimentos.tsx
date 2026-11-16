import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useMinhaFila } from "@/components/atendimento";
import {
  Abas,
  Botao,
  Carregando,
  Cartao,
  CartaoTocavel,
  Faixa,
  Segmentado,
  Tela,
  TextoSuave,
  Titulo,
} from "@/components/ui";

type Aba = "proximos" | "historico";

/**
 * Meus atendimentos: o que está marcado para outros dias, a lista de espera e a reserva ("próximos"),
 * e o que já terminou ("histórico"). O de hoje fica na aba "hoje".
 */
export default function Atendimentos() {
  const f = useMinhaFila();
  const [aba, setAba] = useState<Aba>("proximos");
  const proximos = f.lista
    .filter((x) => x.resumo.grupo === "proximos" || x.resumo.grupo === "sem_data")
    .sort((a, b) => (a.en.sessao?.inicio ?? "9").localeCompare(b.en.sessao?.inicio ?? "9"));
  const historico = f.lista.filter((x) => x.resumo.grupo === "encerrados");
  const deHoje = f.lista.filter((x) => x.resumo.grupo === "hoje").length;
  const itens = aba === "proximos" ? proximos : historico;

  return (
    <Tela voltar={false} rodape={<Abas atual="atendimentos" />}>
      <Titulo>meus atendimentos</Titulo>
      <Segmentado
        atual={aba}
        mudar={setAba}
        opcoes={[
          { id: "proximos", rotulo: `próximos${proximos.length > 0 ? ` (${proximos.length})` : ""}` },
          { id: "historico", rotulo: `histórico${historico.length > 0 ? ` (${historico.length})` : ""}` },
        ]}
      />
      {f.erro ? (
        <Faixa
          tipo="perigo"
          titulo={f.erro.titulo}
          texto={f.erro.texto}
          acao={{ texto: "tentar de novo", onPress: () => void f.tentarDeNovo(), carregando: f.tentando }}
        />
      ) : null}
      {f.cancelada ? <Faixa tipo="ok" titulo="pronto, inscrição cancelada" texto={f.cancelada} /> : null}
      {deHoje > 0 && aba === "proximos" ? (
        <CartaoTocavel acao="ver o de hoje" onPress={() => router.replace("/inicio")}>
          <TextoSuave>
            {deHoje === 1 ? "você tem 1 atendimento hoje." : `você tem ${deHoje} atendimentos hoje.`}
          </TextoSuave>
        </CartaoTocavel>
      ) : null}
      {f.entradas === null && !f.erro ? <Carregando texto="buscando os seus atendimentos…" /> : null}
      {f.entradas !== null && itens.length === 0 ? (
        <Cartao style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
          <TextoSuave style={{ textAlign: "center" }}>
            {aba === "proximos"
              ? "nenhum atendimento marcado para os próximos dias."
              : "os atendimentos que terminarem aparecem aqui."}
          </TextoSuave>
          {aba === "proximos" ? (
            <View style={{ alignSelf: "stretch" }}>
              <Botao texto="procurar uma unidade" onPress={() => router.replace("/unidades")} />
            </View>
          ) : null}
        </Cartao>
      ) : null}
      {f.cartoes(itens, "lista")}
      {f.gaveta}
    </Tela>
  );
}
