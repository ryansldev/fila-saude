import { router, useLocalSearchParams } from "expo-router";
import { Check } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { FaixaDosAvisos, SuaVez, useMinhaFila } from "@/components/atendimento";
import {
  Botao,
  BotaoLigar,
  Carregando,
  COR,
  corDoTom,
  Faixa,
  FONTE,
  LinkBotao,
  Pequeno,
  Selo,
  Tela,
  TextoSuave,
  Titulo,
} from "@/components/ui";
import { hora } from "@/lib/datas";
import { type DestaqueDaFila, destaqueDaFila, type Passo, passosDaFila } from "@/lib/fila";
import { ORIENTACAO_PIOROU, proximoPasso, resumoDaEntrada } from "@/lib/textos";

/**
 * Tela da fila de um atendimento: a senha bem grande, a posição e o tempo, a linha do tempo do dia
 * e o que fazer agora. Consulta a cada ~3 s, como "hoje" (PD-33); a vez abre a tela verde.
 */
export default function TelaDaFila() {
  const { entradaId } = useLocalSearchParams<{ entradaId: string }>();
  const f = useMinhaFila();
  const [piorou, setPiorou] = useState(false);
  const item = f.lista.find((x) => x.en.entradaId === entradaId);

  if (f.vez && f.vez.entradaId === entradaId) {
    return <SuaVez senha={f.vez.senha} estacao={f.vez.estacao} fechar={f.vez.dispensar} />;
  }
  if (f.entradas === null) {
    return (
      <Tela>
        {f.erro ? (
          <Faixa
            tipo="perigo"
            titulo={f.erro.titulo}
            texto={f.erro.texto}
            acao={{ texto: "tentar de novo", onPress: () => void f.tentarDeNovo(), carregando: f.tentando }}
          />
        ) : (
          <Carregando texto="buscando a sua fila" />
        )}
      </Tela>
    );
  }
  if (!item) {
    // Cancelada agora há pouco (ou de outra conta): a entrada some da lista.
    return (
      <Tela
        acoes={
          <Botao texto="voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace("/inicio"))} />
        }
      >
        <Titulo>{f.cancelada ? "pronto" : "inscrição não encontrada"}</Titulo>
        <TextoSuave>{f.cancelada ?? "ela não está mais na sua lista."}</TextoSuave>
      </Tela>
    );
  }

  const { en, sit } = item;
  const agora = Date.now();
  const r = resumoDaEntrada(en, sit, agora);
  const destaque = destaqueDaFila(en, sit);
  const passos = passosDaFila(en, sit);
  const { aoCancelar, vouSair } = f.acoesDe(en, sit);
  const presente = (sit.tipo === "posicao" || sit.tipo === "sem_previsao") && sit.presente;
  const podeCheckIn = ["posicao", "venha", "sem_previsao"].includes(sit.tipo) && en.itemEstado === "remoto";

  const principal =
    sit.tipo === "recepcao" ? (
      <Botao texto="ler o QR de novo" tipo="secundario" onPress={() => router.push("/check-in")} />
    ) : podeCheckIn ? (
      <Botao texto="cheguei na unidade" onPress={() => router.push("/check-in")} />
    ) : presente ? (
      vouSair ? (
        <Botao texto="vou sair um pouco" tipo="secundario" onPress={vouSair} />
      ) : (
        <Carregando />
      )
    ) : null;

  return (
    <Tela acoes={principal}>
      <View style={{ gap: 6 }}>
        <Titulo>{en.servico.toLowerCase()}</Titulo>
        <Pequeno>
          {en.sessao ? `${hora(en.sessao.inicio)} às ${hora(en.sessao.fim)} · ` : ""}
          {en.unidade}
          {en.paraMim ? "" : ` · para ${en.pessoa}`}
        </Pequeno>
        <Selo texto={r.selo} tom={r.tom} />
      </View>

      <BlocoDaSenha d={destaque} />

      {f.erro ? <Faixa tipo="aviso" titulo={f.erro.titulo} texto={f.erro.texto} /> : null}

      <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 28, color: COR.ink }}>
        {proximoPasso(en, sit, agora)}
      </Text>

      {r.naFila ? <FaixaDosAvisos /> : null}

      {passos.length > 0 ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 18, color: COR.ink }}>seu caminho hoje</Text>
          <LinhaDoTempo passos={passos} />
        </View>
      ) : null}

      {presente && !piorou ? (
        <LinkBotao texto="meus sintomas pioraram" cor={COR.dangerInk} onPress={() => setPiorou(true)} />
      ) : null}
      {presente && piorou ? (
        <View style={{ gap: 10 }}>
          <Faixa tipo="perigo" titulo="seus sintomas pioraram?" texto={ORIENTACAO_PIOROU} />
          <BotaoLigar texto="ligar 192 · SAMU" numero="192" tipo="secundario" />
        </View>
      ) : null}
      {aoCancelar ? <LinkBotao texto="não vou poder ir" cor={COR.dangerInk} onPress={aoCancelar} /> : null}
      {f.gaveta}
    </Tela>
  );
}

/** A senha bem grande, na cor da situação; na fila, a posição e o tempo ao lado um do outro. */
function BlocoDaSenha({ d }: { d: DestaqueDaFila }) {
  const t = corDoTom(d.tom);
  const vez = d.tom === "verde" && d.sala !== undefined;
  const fundo = vez ? COR.call : t.fundo;
  const tinta = vez ? "#ffffff" : t.texto;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ borderRadius: 24, padding: 20, gap: 14, backgroundColor: fundo, alignItems: "center" }}
    >
      <Text style={{ fontFamily: FONTE.bold, fontSize: 17, color: tinta }}>{d.rotulo}</Text>
      {d.senha ? (
        <Text
          accessibilityLabel={`senha ${d.senha}`}
          adjustsFontSizeToFit
          numberOfLines={1}
          style={{
            fontFamily: FONTE.extra,
            fontSize: 76,
            lineHeight: 84,
            letterSpacing: 2,
            color: vez ? "#ffffff" : COR.ink,
          }}
        >
          {d.senha}
        </Text>
      ) : null}
      {d.sala ? (
        <Text style={{ fontFamily: FONTE.extra, fontSize: 26, lineHeight: 32, color: tinta }}>{d.sala}</Text>
      ) : null}
      {d.posicao !== undefined ? (
        <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
          <Numero valor={`${d.posicao}º`} legenda="na fila" />
          <Numero
            valor={d.posicao <= 1 || (d.minutos ?? 0) <= 0 ? "já já" : `~${d.minutos} min`}
            legenda={d.posicao <= 1 ? "você é o próximo" : "para a sua vez"}
          />
        </View>
      ) : null}
    </View>
  );
}

function Numero({ valor, legenda }: { valor: string; legenda: string }) {
  return (
    <View
      style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 16, backgroundColor: COR.surface }}
    >
      <Text style={{ fontFamily: FONTE.extra, fontSize: 32, lineHeight: 38, color: COR.action }}>{valor}</Text>
      <Pequeno>{legenda}</Pequeno>
    </View>
  );
}

/** Etapas do dia, de cima para baixo: feitas com ✓, a de agora em destaque, as próximas apagadas. */
function LinhaDoTempo({ passos }: { passos: Passo[] }) {
  return (
    <View accessibilityRole="list">
      {passos.map((p, i) => {
        const ultimo = i === passos.length - 1;
        const feito = p.estado === "feito";
        const agora = p.estado === "atual" || p.estado === "pendente";
        const cor = feito || p.estado === "atual" ? COR.action : p.estado === "pendente" ? "#9aa3a5" : COR.linha;
        return (
          <View
            key={p.id}
            accessibilityLabel={`${p.titulo}: ${feito ? "feito" : agora ? "agora" : "depois"}`}
            style={{ flexDirection: "row", gap: 14, minHeight: 52 }}
          >
            <View style={{ alignItems: "center", width: 30 }}>
              <View
                style={{
                  width: agora ? 30 : 24,
                  height: agora ? 30 : 24,
                  borderRadius: 999,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: feito ? COR.action : COR.surface,
                  borderWidth: feito ? 0 : agora ? 4 : 3,
                  borderColor: cor,
                  borderStyle: p.estado === "pendente" ? "dashed" : "solid",
                }}
              >
                {feito ? <Check size={14} color="#ffffff" strokeWidth={3.5} /> : null}
              </View>
              {ultimo ? null : (
                <View
                  style={{ flex: 1, width: 4, marginVertical: 2, backgroundColor: feito ? COR.action : COR.linha }}
                />
              )}
            </View>
            <Text
              style={{
                flex: 1,
                paddingTop: agora ? 3 : 1,
                fontFamily: agora ? FONTE.extra : FONTE.semi,
                fontSize: agora ? 19 : 16,
                color: p.estado === "futuro" ? COR.inkMuted : COR.ink,
              }}
            >
              {p.titulo}
              {agora ? (p.estado === "pendente" ? " · ainda não começou" : " · agora") : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
