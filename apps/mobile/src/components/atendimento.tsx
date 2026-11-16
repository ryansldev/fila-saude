import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { router, useFocusEffect } from "expo-router";
import { ChevronRight, Ellipsis, Hourglass, QrCode } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Alert, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AreaTocavel,
  Avatar,
  BlocoData,
  Botao,
  BotaoLigar,
  Carregando,
  Cartao,
  COR,
  Faixa,
  FONTE,
  Gaveta,
  Logo,
  Pequeno,
  Selo,
  TextoSuave,
  Titulo,
  Trilha,
} from "@/components/ui";
import { INTERVALO_DA_CONSULTA_MS } from "@/lib/config";
import { nomeProprio } from "@/lib/conta";
import { diaCurto, ehHoje, hora, partesDoDia } from "@/lib/datas";
import { bilheteDo, linhaDo } from "@/lib/hoje";
import { podeRefazer } from "@/lib/inscricoes";
import { useSessao } from "@/lib/sessao";
import {
  avisoDoCancelamento,
  avisoDoErro,
  mensagemDoErro,
  ORIENTACAO_PIOROU,
  proximoPasso,
  resumoDaEntrada,
  type Situacao,
  situacaoDaEntrada,
} from "@/lib/textos";

// "hoje" só quando a sessão é hoje no fuso da unidade; senão, o dia.
export const quando = (en: MinhaEntrada) =>
  en.sessao ? (ehHoje(en.sessao.inicio, Date.now()) ? " · hoje" : ` · ${diaCurto(en.sessao.inicio)}`) : "";
export const contexto = (en: MinhaEntrada) =>
  `${en.unidade} · ${en.servico.toLowerCase()}${quando(en)}${en.paraMim ? "" : ` · para ${nomeProprio(en.pessoa)}`}`;
export const faltam = (posicao: number, minutos: number) =>
  minutos <= 0 || posicao <= 1 ? "você é o próximo" : `cerca de ${minutos} min para a sua vez`;

// "é a sua vez" dispensado não volta ao trocar de aba (a tela remonta); vale enquanto o app está aberto.
export const VEZES_VISTAS = new Set<string>();

export const efeitoDoCancelamento = (sit: Situacao) =>
  sit.tipo === "reserva"
    ? "você sai da reserva."
    : sit.tipo === "lista"
      ? "você sai da lista de espera."
      : "você perde esta vaga.";

/** Confirmação do "não vou poder ir" (tela 10): diz o efeito antes; o botão de perigo é o principal. */
export function ConfirmarCancelamento({
  alvo,
  fechar,
  confirmar,
}: {
  alvo: { en: MinhaEntrada; sit: Situacao; ctx: string } | null;
  fechar: () => void;
  confirmar: (entradaId: string) => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Enquanto envia, a gaveta não fecha (o pedido terminaria sem ninguém ver o resultado). Ao fechar, o
  // erro some: a próxima abertura começa limpa.
  const fecharGaveta = () => {
    if (enviando) return;
    setErro(null);
    fechar();
  };
  return (
    <Gaveta aberta={alvo !== null} fechar={fecharGaveta} travada={enviando}>
      {alvo ? (
        <>
          <Titulo>não vou poder ir?</Titulo>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 28, color: COR.dangerInk }}>
            {efeitoDoCancelamento(alvo.sit)}
          </Text>
          <Pequeno>{alvo.ctx}</Pequeno>
          <TextoSuave>para outro dia, faça uma nova inscrição.</TextoSuave>
          {erro ? <Faixa tipo="perigo" titulo="não deu certo" texto={erro} /> : null}
          <Botao
            texto="não vou poder ir"
            variante="perigo"
            carregando={enviando}
            onPress={async () => {
              setEnviando(true);
              setErro(null);
              try {
                await confirmar(alvo.en.entradaId);
              } catch (err) {
                setErro(mensagemDoErro(err));
              } finally {
                setEnviando(false);
              }
            }}
          />
          <Botao texto="voltar, eu vou" variante="secundario" onPress={fecharGaveta} desativado={enviando} />
        </>
      ) : null}
    </Gaveta>
  );
}

/** "é a sua vez!": tela cheia verde, como no design. */
export function SuaVez({ senha, estacao, fechar }: { senha: string; estacao: string | null; fechar: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COR.call }}>
      <View
        style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}
        accessibilityLiveRegion="assertive"
      >
        <Logo tamanho={56} cor="#ffffff" miolo={COR.call} />
        <Text style={{ fontFamily: FONTE.extra, fontSize: 40, lineHeight: 44, color: "#ffffff" }}>é a sua vez!</Text>
        <Text style={{ fontFamily: FONTE.bold, fontSize: 18, color: "#ffffff" }}>senha</Text>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 88, lineHeight: 92, color: "#ffffff", letterSpacing: 2 }}>
          {senha}
        </Text>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 28, lineHeight: 34, color: "#ffffff" }}>
          {estacao ? estacao.toLowerCase() : "veja a sala na TV"}
        </Text>
        <View style={{ alignSelf: "stretch", marginTop: 24 }}>
          <Botao texto="estou indo" variante="branco" onPress={fechar} />
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Senha e posição, quando a pessoa já está na fila: o maior texto do cartão. */
function NaFila({ en, sit }: { en: MinhaEntrada; sit: Situacao }) {
  switch (sit.tipo) {
    case "posicao":
      return <Posicao senha={en.senha} posicao={sit.posicao} detalhe={faltam(sit.posicao, sit.minutos)} />;
    case "sem_previsao":
      return <Posicao senha={en.senha} detalhe="sem previsão de tempo agora" />;
    case "venha":
      return <Posicao senha={en.senha} detalhe="você é o próximo" />;
    case "recepcao":
      return <Posicao senha={en.senha} detalhe="mostre esta senha na recepção" />;
    default:
      return null;
  }
}

/** Senha e posição, o maior texto do cartão. */
export function Posicao({ senha, posicao, detalhe }: { senha: string | null; posicao?: number; detalhe: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        padding: 16,
        borderRadius: 18,
        backgroundColor: COR.primary50,
      }}
    >
      {posicao !== undefined ? (
        <View style={{ alignItems: "center", minWidth: 72 }}>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 48, lineHeight: 52, color: COR.action }}>{posicao}º</Text>
          <Pequeno>da fila</Pequeno>
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        {senha ? (
          <Text style={{ fontFamily: FONTE.extra, fontSize: 22, lineHeight: 28, color: COR.ink, letterSpacing: 1 }}>
            senha {senha}
          </Text>
        ) : null}
        <Text style={{ fontFamily: FONTE.bold, fontSize: 17, lineHeight: 24, color: COR.actionPressed }}>
          {detalhe}
        </Text>
      </View>
    </View>
  );
}

/**
 * Um atendimento (revisão de 2026-11-14): o que é, quando (dia e faixa de horário), onde, para quem,
 * a senha quando já está na fila, uma frase com o próximo passo e uma ação principal.
 */
export function CartaoDoAtendimento({
  en,
  sit,
  vouSair,
  aoCancelar,
  responder = null,
  refazer = null,
  aoAbrir,
  variante = "destaque",
}: {
  en: MinhaEntrada;
  sit: Situacao;
  vouSair: (() => void) | null;
  aoCancelar: (() => void) | null;
  /** RN-CONF-01: alocada, à espera da resposta; `null` enquanto envia ou fora disso. */
  responder?: ((r: "confirmar" | "recusar") => void) | null;
  /** RN-RISCO-03 / I9: refazer o questionário enquanto está na lista. */
  refazer?: (() => void) | null;
  /** Abre a tela da fila deste atendimento (senha grande e progresso). */
  aoAbrir?: () => void;
  /** "destaque": o de hoje, como o acompanhamento de um pedido; "lista": compacto, com o dia à esquerda. */
  variante?: "destaque" | "lista";
}) {
  const agora = Date.now();
  const r = resumoDaEntrada(en, sit, agora);
  const [piorou, setPiorou] = useState(false);
  if (variante === "lista") return <CartaoNaLista en={en} sit={sit} aoCancelar={aoCancelar} aoAbrir={aoAbrir} />;
  const podeCheckIn = ["posicao", "venha", "sem_previsao"].includes(sit.tipo) && en.itemEstado === "remoto";
  const presente = (sit.tipo === "posicao" || sit.tipo === "sem_previsao") && sit.presente;
  const mostraTrilha = r.etapa !== null && r.etapa < 4;
  return (
    <Cartao style={{ gap: 0, padding: 0 }}>
      <Tocavel aoAbrir={aoAbrir} en={en} style={{ padding: 14 }}>
        <CabecaDoAtendimento en={en} sit={sit} aoAbrir={aoAbrir} />
      </Tocavel>
      <View style={{ gap: 16, padding: 16, borderTopWidth: 2, borderTopColor: COR.surfaceMuted }}>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 19, lineHeight: 26, color: COR.ink }}>
          {proximoPasso(en, sit, agora)}
        </Text>
        {mostraTrilha ? <Trilha etapa={r.etapa ?? 0} pendente={!r.naFila} /> : null}
        <NaFila en={en} sit={sit} />
        {sit.tipo === "recepcao" ? (
          <Botao texto="ler o QR de novo" variante="secundario" onPress={() => router.push("/check-in")} />
        ) : null}
        {podeCheckIn ? <Botao texto="cheguei na unidade" onPress={() => router.push("/check-in")} /> : null}
        {presente ? (
          vouSair ? (
            <Botao texto="vou sair um pouco" variante="secundario" onPress={vouSair} />
          ) : (
            <Carregando />
          )
        ) : null}
        {presente && !piorou ? (
          <Botao variante="textoPerigo" texto="meus sintomas pioraram" onPress={() => setPiorou(true)} />
        ) : null}
        {presente && piorou ? (
          <View style={{ gap: 10 }}>
            <Faixa tipo="perigo" titulo="seus sintomas pioraram?" texto={ORIENTACAO_PIOROU} />
            <BotaoLigar texto="ligar para o SAMU (192)" numero="192" variante="secundario" />
          </View>
        ) : null}
        {sit.tipo === "alocada" ? (
          responder ? (
            <>
              <Botao texto="vou, confirmar" onPress={() => responder("confirmar")} />
              <Botao texto="não posso nesta data" variante="secundario" onPress={() => responder("recusar")} />
            </>
          ) : (
            <Carregando />
          )
        ) : null}
        {refazer ? <Botao variante="texto" texto="minha situação mudou: responder de novo" onPress={refazer} /> : null}
        {aoCancelar ? (
          <Botao
            variante="textoPerigo"
            texto={sit.tipo === "alocada" || sit.tipo === "lista" ? "sair da lista de espera" : "não vou poder ir"}
            onPress={aoCancelar}
          />
        ) : null}
      </View>
    </Cartao>
  );
}

/** A linha de cima de todo cartão de atendimento: o dia num bloco à esquerda, o que é, a hora, onde e a situação. */
/** Área que abre a tela da fila; sem `aoAbrir`, é só uma caixa. */
function Tocavel({
  aoAbrir,
  en,
  style,
  children,
}: {
  aoAbrir: (() => void) | undefined;
  en: MinhaEntrada;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  if (!aoAbrir) return <View style={style}>{children}</View>;
  return (
    <AreaTocavel
      rotulo={`ver a fila de ${en.servico.toLowerCase()}`}
      onPress={aoAbrir}
      style={(pressed) => ({ ...style, ...(pressed ? { opacity: 0.6 } : {}) })}
    >
      {children}
    </AreaTocavel>
  );
}

function CabecaDoAtendimento({
  en,
  sit,
  aoAbrir,
}: {
  en: MinhaEntrada;
  sit: Situacao;
  aoAbrir?: (() => void) | undefined;
}) {
  const agora = Date.now();
  const r = resumoDaEntrada(en, sit, agora);
  const encerrado = r.grupo === "encerrados";
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      {en.sessao ? (
        <BlocoData {...partesDoDia(en.sessao.inicio, agora)} tom={encerrado ? "cinza" : r.tom} />
      ) : (
        <Avatar Icone={Hourglass} tom={r.tom} />
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: encerrado ? COR.inkMuted : COR.ink }}
        >
          {en.servico.toLowerCase()}
        </Text>
        <Pequeno>
          {en.sessao ? `${hora(en.sessao.inicio)} às ${hora(en.sessao.fim)} · ` : ""}
          {en.unidade}
          {en.paraMim ? "" : ` · para ${nomeProprio(en.pessoa)}`}
        </Pequeno>
        <Selo texto={r.selo} tom={r.tom} />
      </View>
      {aoAbrir ? <ChevronRight size={26} color={COR.inkMuted} strokeWidth={2.5} /> : null}
    </View>
  );
}

/** Versão compacta, para a lista de atendimentos: só a linha de cima, o próximo passo e o cancelar. */
function CartaoNaLista({
  en,
  sit,
  aoCancelar,
  aoAbrir,
}: {
  en: MinhaEntrada;
  sit: Situacao;
  aoCancelar: (() => void) | null;
  aoAbrir?: (() => void) | undefined;
}) {
  const agora = Date.now();
  const encerrado = resumoDaEntrada(en, sit, agora).grupo === "encerrados";
  return (
    <Cartao style={{ gap: 12, padding: 14 }}>
      <Tocavel aoAbrir={aoAbrir} en={en} style={{ gap: 12 }}>
        <CabecaDoAtendimento en={en} sit={sit} aoAbrir={aoAbrir} />
        {encerrado ? null : (
          <Text style={{ fontFamily: FONTE.semi, fontSize: 16, lineHeight: 22, color: COR.ink }}>
            {proximoPasso(en, sit, agora)}
          </Text>
        )}
      </Tocavel>
      {aoCancelar ? (
        <View style={{ borderTopWidth: 2, borderTopColor: COR.surfaceMuted, marginTop: -2 }}>
          <Botao variante="textoPerigo" texto="não vou poder ir" onPress={aoCancelar} />
        </View>
      ) : null}
    </Cartao>
  );
}

export const SECOES: { id: "hoje" | "proximos" | "sem_data" | "encerrados"; titulo: string }[] = [
  { id: "hoje", titulo: "hoje" },
  { id: "proximos", titulo: "próximos" },
  { id: "sem_data", titulo: "sem data marcada" },
  { id: "encerrados", titulo: "encerrados" },
];

/** Minha fila (T3.4): consulta a cada ~3 s enquanto está na frente (PD-33). */

/**
 * A fila da conta no município: consulta a cada ~3 s enquanto a tela está na frente (PD-33),
 * com "vou sair", "não vou poder ir" e o "é a sua vez" já dispensado. Usado por "hoje" e "atendimentos".
 */
export function useMinhaFila() {
  const s = useSessao();
  const [entradas, setEntradas] = useState<MinhaEntrada[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [vistas, setVistas] = useState<string[]>(() => [...VEZES_VISTAS]);
  const [saindo, setSaindo] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [cancelar, setCancelar] = useState<{ en: MinhaEntrada; sit: Situacao; ctx: string } | null>(null);
  const [cancelada, setCancelada] = useState<string | null>(null);
  const [tentando, setTentando] = useState(false);
  const buscarAgora = useRef<(() => Promise<void>) | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!s.municipio) return;
      let ativo = true;
      // Trocou de município ou de conta: nada da lista anterior fica na tela.
      setEntradas(null);
      const buscar = () =>
        s.api
          .get<MinhaEntrada[]>(`/v1/municipios/${s.municipio}/minhas`)
          .then((l) => {
            if (!ativo) return;
            setEntradas(l);
            setErro(null);
          })
          .catch((err) => {
            if (ativo) setErro(avisoDoErro(err));
          });
      buscarAgora.current = buscar;
      void buscar();
      const id = setInterval(buscar, INTERVALO_DA_CONSULTA_MS);
      return () => {
        ativo = false;
        buscarAgora.current = null;
        clearInterval(id);
      };
    }, [s.api, s.municipio]),
  );

  const agora = Date.now();
  const lista = (entradas ?? []).map((en) => {
    const sit = situacaoDaEntrada(en, agora);
    return { en, sit, resumo: resumoDaEntrada(en, sit, agora) };
  });
  const vez = lista.find(
    (x): x is typeof x & { sit: Extract<Situacao, { tipo: "vez" }> } =>
      x.sit.tipo === "vez" && !vistas.includes(`${x.en.entradaId}:${x.en.chamada?.em}`),
  );

  /** "não vou poder ir" e "vou sair" de uma entrada, iguais no cartão e na tela da fila. */
  /** RN-CONF-01/04: confirmar ou recusar a data que a unidade marcou. */
  const enviarResposta = (en: MinhaEntrada, r: "confirmar" | "recusar") => {
    setRespondendo(en.entradaId);
    s.api
      .post<{ estado: string }>(`/v1/municipios/${s.municipio}/entradas/${en.entradaId}/${r}`)
      .then((res) => {
        setEntradas((l) =>
          (l ?? []).map((x) =>
            x.entradaId === en.entradaId
              ? { ...x, estado: res.estado, prazoConfirmacao: null, ...(r === "recusar" ? { sessao: null } : {}) }
              : x,
          ),
        );
        if (r === "recusar")
          Alert.alert("tudo certo", "a vaga fica para outra pessoa. você continua na lista de espera.");
        void buscarAgora.current?.();
      })
      .catch((err) => Alert.alert("não deu certo", mensagemDoErro(err)))
      .finally(() => setRespondendo(null));
  };

  const acoesDe = (en: MinhaEntrada, sit: Situacao) => ({
    responder:
      sit.tipo !== "alocada" || respondendo === en.entradaId
        ? null
        : (r: "confirmar" | "recusar") =>
            r === "confirmar"
              ? enviarResposta(en, r)
              : Alert.alert(
                  "não pode nesta data?",
                  "a vaga fica para outra pessoa. você continua na lista, com a mesma data de entrada.",
                  [
                    { text: "voltar", style: "cancel" },
                    { text: "não posso", style: "destructive", onPress: () => enviarResposta(en, "recusar") },
                  ],
                ),
    refazer: podeRefazer(en)
      ? () =>
          router.push({
            pathname: "/inscricao/[sessaoId]",
            params: {
              sessaoId: "refazer",
              entradaId: en.entradaId,
              servicoId: en.servicoId,
              servico: en.servico,
              unidade: en.unidade,
              nascimento: en.nascimento,
              paraMim: en.paraMim ? "1" : "0",
            },
          })
      : null,
    // RN-CANC-01: a API diz quando o "não vou poder ir" vale.
    aoCancelar: en.podeCancelar
      ? () => {
          setCancelada(null);
          setCancelar({ en, sit, ctx: contexto(en) });
        }
      : null,
    vouSair:
      saindo === en.entradaId
        ? null
        : () => {
            // RN-PRES-02: volta a remoto mantendo a posição; um toque por vez.
            setSaindo(en.entradaId);
            s.api
              .post(`/v1/municipios/${s.municipio}/entradas/${en.entradaId}/vou-sair`)
              .then(() => {
                setEntradas((l) =>
                  (l ?? []).map((x) => (x.entradaId === en.entradaId ? { ...x, itemEstado: "remoto" } : x)),
                );
                void buscarAgora.current?.();
              })
              .catch((err) => Alert.alert("não deu certo", mensagemDoErro(err)))
              .finally(() => setSaindo(null));
          },
  });

  return {
    entradas,
    lista,
    erro,
    tentando,
    cancelada,
    vez: vez
      ? {
          entradaId: vez.en.entradaId,
          senha: vez.sit.senha,
          estacao: vez.sit.estacao,
          dispensar: () => {
            const chave = `${vez.en.entradaId}:${vez.en.chamada?.em}`;
            VEZES_VISTAS.add(chave);
            setVistas((v) => [...v, chave]);
          },
        }
      : null,
    tentarDeNovo: async () => {
      setTentando(true);
      await buscarAgora.current?.();
      setTentando(false);
    },
    acoesDe,
    /** Os cartões de uma lista, com as ações certas de cada um; tocar abre a tela da fila. */
    cartoes: (itens: typeof lista, variante: "destaque" | "lista" = "destaque") =>
      itens.map(({ en, sit }) => (
        <CartaoDoAtendimento
          key={en.entradaId}
          en={en}
          sit={sit}
          variante={variante}
          {...acoesDe(en, sit)}
          aoAbrir={() => router.push({ pathname: "/fila/[entradaId]", params: { entradaId: en.entradaId } })}
        />
      )),
    /** A gaveta do "não vou poder ir"; vai uma vez na tela. */
    gaveta: (
      <ConfirmarCancelamento
        alvo={cancelar}
        fechar={() => setCancelar(null)}
        confirmar={async (entradaId) => {
          await s.api.post(`/v1/municipios/${s.municipio}/entradas/${entradaId}/cancelar`);
          const aviso = cancelar ? avisoDoCancelamento(cancelar.sit) : avisoDoCancelamento({ tipo: "confirmada" });
          setEntradas((l) => (l ?? []).filter((x) => x.entradaId !== entradaId));
          setCancelar(null);
          setCancelada(aviso);
          void buscarAgora.current?.();
        }}
      />
    ),
  };
}

/** Faixa dos avisos desligados (o "saia de casa" só chega com eles ligados). */
export function FaixaDosAvisos() {
  const s = useSessao();
  if (!s.avisos || s.avisos.tipo === "ligados") return null;
  const semPedido = s.avisos.tipo === "desligados" && !s.avisos.podePedir;
  return (
    <Faixa
      tipo="aviso"
      titulo="os avisos estão desligados"
      texto="sem eles, você só sabe a hora de sair com o app aberto."
      acao={{ texto: semPedido ? "abrir os ajustes" : "ligar os avisos", onPress: () => void s.ligarAvisos() }}
    />
  );
}

// --- Aba "hoje" (design de 2026-11-16): o bilhete, as linhas e as ações raras numa gaveta ---

const FUNDO_DO_HOJE = "#f4f7f8";
const SOMBRA: ViewStyle = {
  shadowColor: "#0c2e4e",
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

export { FUNDO_DO_HOJE };

/** O bilhete do atendimento que mais pede ação agora: a faixa, o que é, o picote, a senha enorme e o botão. */
export function BilheteDoDia({
  en,
  sit,
  responder,
  aoAbrir,
  aoMais,
}: {
  en: MinhaEntrada;
  sit: Situacao;
  responder: ((r: "confirmar" | "recusar") => void) | null;
  aoAbrir: () => void;
  aoMais: () => void;
}) {
  const b = bilheteDo(en, sit);
  return (
    <View style={[{ backgroundColor: COR.surface, borderRadius: 22, overflow: "hidden" }, SOMBRA]}>
      <View
        style={{
          backgroundColor: COR.action,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 18,
          paddingRight: 8,
          paddingVertical: 6,
        }}
      >
        <Text style={{ flex: 1, fontFamily: FONTE.extra, fontSize: 18, lineHeight: 24, color: "#ffffff" }}>
          {b.faixa}
        </Text>
        <AreaTocavel
          rotulo="mais opções"
          onPress={aoMais}
          style={(pressed) => ({ padding: 10, borderRadius: 999, opacity: pressed ? 0.6 : 1 })}
        >
          <Ellipsis size={24} color="#cfe2f6" strokeWidth={2.6} />
        </AreaTocavel>
      </View>
      <Tocavel aoAbrir={aoAbrir} en={en} style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16, gap: 2 }}>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 21, lineHeight: 27, color: COR.ink }}>
          {en.servico.toLowerCase()}
        </Text>
        <TextoSuave style={{ fontSize: 16, lineHeight: 22 }}>
          {en.unidade}
          {en.paraMim ? "" : `, para ${nomeProprio(en.pessoa)}`}
        </TextoSuave>
      </Tocavel>
      <Picote />
      <View style={{ alignItems: "center", gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 }}>
        {b.senha ? (
          <>
            <Text style={{ fontFamily: FONTE.extra, fontSize: 13, letterSpacing: 1.2, color: COR.inkMuted }}>
              SUA SENHA
            </Text>
            <Text style={{ fontFamily: FONTE.extra, fontSize: 56, lineHeight: 62, color: COR.primary900 }}>
              {b.senha}
            </Text>
          </>
        ) : (
          <TextoSuave style={{ textAlign: "center" }}>
            {b.botao === "confirmar"
              ? `${en.sessao ? janelaCurta(en.sessao.inicio, en.sessao.fim) : ""}`
              : "a senha sai quando a fila abrir."}
          </TextoSuave>
        )}
        {b.botao === "qr" ? (
          <View style={{ alignSelf: "stretch" }}>
            <Botao texto="cheguei: ler o QR" icone={QrCode} onPress={() => router.push("/check-in")} />
          </View>
        ) : null}
        {b.botao === "confirmar" ? (
          <View style={{ alignSelf: "stretch" }}>
            {responder ? <Botao texto="vou, confirmar" onPress={() => responder("confirmar")} /> : <Carregando />}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const janelaCurta = (inicio: string, fim: string) =>
  `${ehHoje(inicio, Date.now()) ? "hoje" : diaCurto(inicio)}, das ${hora(inicio)} às ${hora(fim)}`;

/** O corte do bilhete: linha tracejada com dois meios-círculos na cor do fundo. */
function Picote() {
  const furo: ViewStyle = {
    position: "absolute",
    top: -12,
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: FUNDO_DO_HOJE,
  };
  return (
    <View style={{ height: 0 }}>
      <View style={{ marginHorizontal: 18, borderTopWidth: 2, borderStyle: "dashed", borderColor: COR.linha }} />
      <View style={[furo, { left: -12 }]} />
      <View style={[furo, { right: -12 }]} />
    </View>
  );
}

/** Um atendimento de "também hoje": o quadro com a posição, o serviço e uma frase curta. */
export function LinhaDoDia({ en, sit, aoAbrir }: { en: MinhaEntrada; sit: Situacao; aoAbrir: () => void }) {
  const l = linhaDo(sit);
  return (
    <AreaTocavel
      rotulo={`${en.servico.toLowerCase()}, ${l.frase}`}
      onPress={aoAbrir}
      style={(pressed) => ({
        ...SOMBRA,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 18,
        backgroundColor: pressed ? COR.primary50 : COR.surface,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: COR.primary50,
        }}
      >
        {l.quadro ? (
          <Text style={{ fontFamily: FONTE.extra, fontSize: 19, color: COR.actionPressed }}>{l.quadro}</Text>
        ) : (
          <Hourglass size={22} color={COR.action} strokeWidth={2.4} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 17, lineHeight: 23, color: COR.ink }}>
          {en.servico.toLowerCase()}
        </Text>
        <Pequeno>{l.frase}</Pequeno>
      </View>
      <ChevronRight size={22} color="#9aa3a5" strokeWidth={2.5} />
    </AreaTocavel>
  );
}

/** "mais opções" do bilhete: só as ações que valem na situação. */
export function OpcoesDoBilhete({
  alvo,
  fechar,
  acoes,
}: {
  alvo: { en: MinhaEntrada; sit: Situacao } | null;
  fechar: () => void;
  acoes: (
    en: MinhaEntrada,
    sit: Situacao,
  ) => {
    responder: ((r: "confirmar" | "recusar") => void) | null;
    refazer: (() => void) | null;
    aoCancelar: (() => void) | null;
    vouSair: (() => void) | null;
  };
}) {
  const [piorou, setPiorou] = useState(false);
  const a = alvo ? acoes(alvo.en, alvo.sit) : null;
  const presente =
    alvo && (alvo.sit.tipo === "posicao" || alvo.sit.tipo === "sem_previsao") ? alvo.sit.presente : false;
  const fazer = (f: (() => void) | null | undefined) => () => {
    fechar();
    f?.();
  };
  return (
    <Gaveta
      aberta={alvo !== null}
      fechar={() => {
        setPiorou(false);
        fechar();
      }}
    >
      {alvo && a ? (
        <>
          <Text style={{ fontFamily: FONTE.extra, fontSize: 20, lineHeight: 26, color: COR.ink }}>
            {alvo.en.servico.toLowerCase()}
          </Text>
          <Botao
            texto="ver o caminho do dia"
            variante="secundario"
            onPress={fazer(() =>
              router.push({ pathname: "/fila/[entradaId]", params: { entradaId: alvo.en.entradaId } }),
            )}
          />
          {presente && a.vouSair ? (
            <Botao texto="vou sair um pouco" variante="secundario" onPress={fazer(a.vouSair)} />
          ) : null}
          {alvo.sit.tipo === "alocada" && a.responder ? (
            <Botao texto="não posso nesta data" variante="secundario" onPress={fazer(() => a.responder?.("recusar"))} />
          ) : null}
          {a.refazer ? (
            <Botao variante="texto" texto="minha situação mudou: responder de novo" onPress={fazer(a.refazer)} />
          ) : null}
          {presente && !piorou ? (
            <Botao variante="textoPerigo" texto="meus sintomas pioraram" onPress={() => setPiorou(true)} />
          ) : null}
          {presente && piorou ? (
            <View style={{ gap: 10 }}>
              <Faixa tipo="perigo" titulo="seus sintomas pioraram?" texto={ORIENTACAO_PIOROU} />
              <BotaoLigar texto="ligar para o SAMU (192)" numero="192" variante="secundario" />
            </View>
          ) : null}
          {a.aoCancelar ? (
            <Botao
              variante="textoPerigo"
              texto={alvo.sit.tipo === "alocada" ? "sair da lista de espera" : "não vou poder ir"}
              onPress={fazer(a.aoCancelar)}
            />
          ) : null}
        </>
      ) : null}
    </Gaveta>
  );
}
