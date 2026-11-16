import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import {
  AbasDoPaciente,
  BilheteDoDia,
  FUNDO_DO_HOJE,
  LinhaDoDia,
  OpcoesDoBilhete,
  SuaVez,
  useMinhaFila,
} from "@/components/atendimento";
import { Botao, Carregando, COR, Faixa, FONTE, Mascote, Pequeno, Tela } from "@/components/ui";
import { primeiroNome } from "@/lib/conta";
import { cumprimentoDoDia, hora, partesDoDia } from "@/lib/datas";
import { ordenarDoDia } from "@/lib/hoje";
import { useSessao } from "@/lib/sessao";

/**
 * Hoje (aba principal, design de 2026-11-16): o atendimento que mais pede ação vira o bilhete, com a
 * senha enorme; os outros do dia, uma linha cada. O resto (outros dias, lista de espera) fica em
 * "atendimentos", com o número na aba.
 */
export default function Hoje() {
  const s = useSessao();
  const f = useMinhaFila();
  const [opcoes, setOpcoes] = useState<{
    en: (typeof f.lista)[number]["en"];
    sit: (typeof f.lista)[number]["sit"];
  } | null>(null);
  if (f.vez) return <SuaVez senha={f.vez.senha} estacao={f.vez.estacao} fechar={f.vez.dispensar} />;

  const deHoje = ordenarDoDia(f.lista.filter((x) => x.resumo.grupo === "hoje"));
  const [bilhete, ...tambem] = deHoje;
  const proximo = f.lista
    .filter((x) => x.resumo.grupo === "proximos" && x.en.sessao)
    .sort((a, b) => (a.en.sessao?.inicio ?? "").localeCompare(b.en.sessao?.inicio ?? ""))[0];
  const nome = s.conta?.nome ? primeiroNome(s.conta.nome) : undefined;
  const resumo =
    deHoje.length === 0
      ? "hoje está livre."
      : deHoje.length === 1
        ? "você tem 1 atendimento hoje."
        : `você tem ${deHoje.length} atendimentos hoje.`;
  const abrir = (entradaId: string) => () => router.push({ pathname: "/fila/[entradaId]", params: { entradaId } });

  return (
    <Tela voltar={false} fundo={FUNDO_DO_HOJE} rodape={<AbasDoPaciente atual="hoje" lista={f.lista} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Mascote tamanho={64} moldura={false} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 24, lineHeight: 30, color: COR.ink }}>
            {cumprimentoDoDia(Date.now())}
            {nome ? `, ${nome}` : ""}!
          </Text>
          <Pequeno style={{ fontSize: 16 }}>{resumo}</Pequeno>
        </View>
      </View>
      {f.erro ? (
        <Faixa
          tipo="perigo"
          titulo={f.erro.titulo}
          texto={f.erro.texto}
          acao={{ texto: "tentar de novo", onPress: () => void f.tentarDeNovo(), carregando: f.tentando }}
        />
      ) : null}
      {f.cancelada ? <Faixa tipo="ok" titulo="pronto, inscrição cancelada" texto={f.cancelada} /> : null}
      {f.entradas === null && !f.erro ? <Carregando texto="buscando o seu dia…" /> : null}
      {bilhete ? (
        <BilheteDoDia
          en={bilhete.en}
          sit={bilhete.sit}
          responder={f.acoesDe(bilhete.en, bilhete.sit).responder}
          aoAbrir={abrir(bilhete.en.entradaId)}
          aoMais={() => setOpcoes({ en: bilhete.en, sit: bilhete.sit })}
        />
      ) : null}
      {tambem.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 14, letterSpacing: 1, color: COR.inkMuted }}>
            TAMBÉM HOJE
          </Text>
          {tambem.map((x) => (
            <LinhaDoDia key={x.en.entradaId} en={x.en} sit={x.sit} aoAbrir={abrir(x.en.entradaId)} />
          ))}
        </View>
      ) : null}
      {f.entradas !== null && deHoje.length === 0 ? (
        proximo?.en.sessao ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: FONTE.extra, fontSize: 14, letterSpacing: 1, color: COR.inkMuted }}>
              PRÓXIMO ATENDIMENTO
            </Text>
            <LinhaDoDia en={proximo.en} sit={proximo.sit} aoAbrir={abrir(proximo.en.entradaId)} />
            <Pequeno>
              {(() => {
                const p = partesDoDia(proximo.en.sessao.inicio, Date.now());
                return `${p.topo === "amanhã" ? "amanhã" : `${p.topo}, ${p.dia} de ${p.mes}`}, às ${hora(proximo.en.sessao.inicio)}`;
              })()}
            </Pequeno>
          </View>
        ) : (
          <Botao
            texto="ver as unidades"
            variante="secundario"
            icone={MapPin}
            onPress={() => router.replace("/unidades")}
          />
        )
      ) : null}
      <OpcoesDoBilhete alvo={opcoes} fechar={() => setOpcoes(null)} acoes={f.acoesDe} />
      {f.gaveta}
    </Tela>
  );
}
