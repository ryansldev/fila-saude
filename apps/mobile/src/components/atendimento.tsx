import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { router, useFocusEffect } from "expo-router";
import { Hourglass } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Avatar,
  BlocoData,
  Botao,
  Carregando,
  Cartao,
  COR,
  Faixa,
  FONTE,
  Gaveta,
  LinkBotao,
  Logo,
  Pequeno,
  Selo,
  TextoSuave,
  Titulo,
  Trilha,
} from "@/components/ui";
import { INTERVALO_DA_CONSULTA_MS } from "@/lib/config";
import { diaCurto, ehHoje, hora, partesDoDia } from "@/lib/datas";
import { useSessao } from "@/lib/sessao";
import {
  avisoDoCancelamento,
  avisoDoErro,
  mensagemDoErro,
  proximoPasso,
  resumoDaEntrada,
  type Situacao,
  situacaoDaEntrada,
} from "@/lib/textos";

// "hoje" só quando a sessão é hoje no fuso da unidade; senão, o dia.
export const quando = (en: MinhaEntrada) =>
  en.sessao ? (ehHoje(en.sessao.inicio, Date.now()) ? " · hoje" : ` · ${diaCurto(en.sessao.inicio)}`) : "";
export const contexto = (en: MinhaEntrada) =>
  `${en.unidade} · ${en.servico.toLowerCase()}${quando(en)}${en.paraMim ? "" : ` · para ${en.pessoa}`}`;
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
            tipo="perigoCheio"
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
          <Botao texto="voltar, eu vou" tipo="secundario" onPress={fecharGaveta} desativado={enviando} />
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
          <Botao texto="estou indo" tipo="branco" corTexto={COR.successInk} onPress={fechar} />
        </View>
      </View>
    </SafeAreaView>
  );
}

export const primeiroNome = (nome: string | undefined) => (nome ? nome.split(/\s+/)[0]?.toLowerCase() : undefined);

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

export const Destaque = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontFamily: FONTE.extra, fontSize: 24, lineHeight: 30, color: COR.ink }}>{children}</Text>
);

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
  variante = "destaque",
}: {
  en: MinhaEntrada;
  sit: Situacao;
  vouSair: (() => void) | null;
  aoCancelar: (() => void) | null;
  /** "destaque": o de hoje, como o acompanhamento de um pedido; "lista": compacto, com o dia à esquerda. */
  variante?: "destaque" | "lista";
}) {
  const agora = Date.now();
  const r = resumoDaEntrada(en, sit, agora);
  if (variante === "lista") return <CartaoNaLista en={en} sit={sit} aoCancelar={aoCancelar} />;
  const podeCheckIn = ["posicao", "venha", "sem_previsao"].includes(sit.tipo) && en.itemEstado === "remoto";
  const presente = (sit.tipo === "posicao" || sit.tipo === "sem_previsao") && sit.presente;
  const mostraTrilha = r.etapa !== null && r.etapa < 4;
  return (
    <Cartao style={{ gap: 0, padding: 0 }}>
      <View style={{ padding: 14 }}>
        <CabecaDoAtendimento en={en} sit={sit} />
      </View>
      <View style={{ gap: 16, padding: 16, borderTopWidth: 2, borderTopColor: COR.surfaceMuted }}>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 19, lineHeight: 26, color: COR.ink }}>
          {proximoPasso(en, sit, agora)}
        </Text>
        {mostraTrilha ? <Trilha etapa={r.etapa ?? 0} pendente={!r.naFila} /> : null}
        <NaFila en={en} sit={sit} />
        {sit.tipo === "recepcao" ? (
          <Botao texto="ler o QR de novo" tipo="secundario" onPress={() => router.push("/check-in")} />
        ) : null}
        {podeCheckIn ? <Botao texto="cheguei na unidade" onPress={() => router.push("/check-in")} /> : null}
        {presente ? (
          vouSair ? (
            <Botao texto="vou sair um pouco" tipo="secundario" onPress={vouSair} />
          ) : (
            <Carregando />
          )
        ) : null}
        {aoCancelar ? <LinkBotao texto="não vou poder ir" cor={COR.dangerInk} onPress={aoCancelar} /> : null}
      </View>
    </Cartao>
  );
}

/** A linha de cima de todo cartão de atendimento: o dia num bloco à esquerda, o que é, a hora, onde e a situação. */
function CabecaDoAtendimento({ en, sit }: { en: MinhaEntrada; sit: Situacao }) {
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
          {en.paraMim ? "" : ` · para ${en.pessoa}`}
        </Pequeno>
        <Selo texto={r.selo} tom={r.tom} />
      </View>
    </View>
  );
}

/** Versão compacta, para a lista de atendimentos: só a linha de cima, o próximo passo e o cancelar. */
function CartaoNaLista({ en, sit, aoCancelar }: { en: MinhaEntrada; sit: Situacao; aoCancelar: (() => void) | null }) {
  const agora = Date.now();
  const encerrado = resumoDaEntrada(en, sit, agora).grupo === "encerrados";
  return (
    <Cartao style={{ gap: 12, padding: 14 }}>
      <CabecaDoAtendimento en={en} sit={sit} />
      {encerrado ? null : (
        <Text style={{ fontFamily: FONTE.semi, fontSize: 16, lineHeight: 22, color: COR.ink }}>
          {proximoPasso(en, sit, agora)}
        </Text>
      )}
      {aoCancelar ? (
        <View style={{ borderTopWidth: 2, borderTopColor: COR.surfaceMuted, marginTop: -2 }}>
          <LinkBotao texto="não vou poder ir" cor={COR.dangerInk} onPress={aoCancelar} />
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

  return {
    entradas,
    lista,
    erro,
    tentando,
    cancelada,
    vez: vez
      ? {
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
    /** Os cartões de uma lista, com as ações certas de cada um. */
    cartoes: (itens: typeof lista, variante: "destaque" | "lista" = "destaque") =>
      itens.map(({ en, sit }) => (
        <CartaoDoAtendimento
          key={en.entradaId}
          en={en}
          sit={sit}
          variante={variante}
          aoCancelar={
            // RN-CANC-01: a API diz quando o "não vou poder ir" vale.
            en.podeCancelar
              ? () => {
                  setCancelada(null);
                  setCancelar({ en, sit, ctx: contexto(en) });
                }
              : null
          }
          vouSair={
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
                }
          }
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
