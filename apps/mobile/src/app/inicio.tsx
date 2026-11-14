import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Abas,
  Botao,
  Carregando,
  Cartao,
  COR,
  Espaco,
  Faixa,
  FONTE,
  Gaveta,
  LinkBotao,
  Logo,
  Mascote,
  Pequeno,
  Selo,
  Tela,
  TextoSuave,
  Titulo,
  Trilha,
} from "@/components/ui";
import { INTERVALO_DA_CONSULTA_MS } from "@/lib/config";
import { diaCurto, ehHoje, hora } from "@/lib/datas";
import { useSessao } from "@/lib/sessao";
import {
  avisoDoCancelamento,
  avisoDoErro,
  mensagemDoErro,
  resumoDaEntrada,
  type Situacao,
  situacaoDaEntrada,
} from "@/lib/textos";

// "hoje" só quando a sessão é hoje no fuso da unidade; senão, o dia.
const quando = (en: MinhaEntrada) =>
  en.sessao ? (ehHoje(en.sessao.inicio, Date.now()) ? " · hoje" : ` · ${diaCurto(en.sessao.inicio)}`) : "";
const contexto = (en: MinhaEntrada) =>
  `${en.unidade} · ${en.servico.toLowerCase()}${quando(en)}${en.paraMim ? "" : ` · para ${en.pessoa}`}`;
const faltam = (posicao: number, minutos: number) =>
  minutos <= 0 || posicao <= 1 ? "você é o próximo" : `cerca de ${minutos} min para a sua vez`;

// "é a sua vez" dispensado não volta ao trocar de aba (a tela remonta); vale enquanto o app está aberto.
const VEZES_VISTAS = new Set<string>();

const efeitoDoCancelamento = (sit: Situacao) =>
  sit.tipo === "reserva"
    ? "você sai da reserva."
    : sit.tipo === "lista"
      ? "você sai da lista de espera."
      : "você perde esta vaga.";

/** Confirmação do "não vou poder ir" (tela 10): diz o efeito antes; o botão de perigo é o principal. */
function ConfirmarCancelamento({
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
function SuaVez({ senha, estacao, fechar }: { senha: string; estacao: string | null; fechar: () => void }) {
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

const primeiroNome = (nome: string | undefined) => (nome ? nome.split(/\s+/)[0]?.toLowerCase() : undefined);

/** A frase que responde "já estou na fila?" e o que vem depois, para cada situação. */
function Explicacao({ en, sit }: { en: MinhaEntrada; sit: Situacao }) {
  const inicio = en.sessao ? `${diaCurto(en.sessao.inicio)}, às ${hora(en.sessao.inicio)}` : "";
  switch (sit.tipo) {
    case "lista":
      return <TextoSuave>você ainda não está em nenhuma fila. a unidade marca a data e te avisa aqui.</TextoSuave>;
    case "reserva":
      return <TextoSuave>você ainda não tem vaga. se alguém desistir, a vaga é sua e a gente te avisa.</TextoSuave>;
    case "alocada":
      return (
        <>
          <Destaque>{inicio}</Destaque>
          <TextoSuave>a unidade marcou esta data para você.</TextoSuave>
        </>
      );
    case "confirmada":
    case "aguardando":
      return (
        <>
          <Destaque>{inicio}</Destaque>
          <TextoSuave>
            você tem vaga, mas ainda não está na fila: a senha e a sua posição aparecem aqui quando a fila abrir.
          </TextoSuave>
        </>
      );
    case "atrasada":
      return (
        <TextoSuave>
          já passou do horário, mas a unidade ainda não abriu a fila. quando abrir, a sua senha aparece aqui.
        </TextoSuave>
      );
    case "posicao":
      return (
        <>
          <Posicao senha={en.senha} posicao={sit.posicao} detalhe={faltam(sit.posicao, sit.minutos)} />
          <TextoSuave>
            {sit.presente
              ? "você está na unidade. fique de olho na TV e no celular."
              : sit.sair
                ? "saia agora para chegar a tempo. ao chegar, leia o QR da TV."
                : "pode esperar em casa. a gente avisa a hora de sair."}
          </TextoSuave>
        </>
      );
    case "sem_previsao":
      return (
        <>
          <Posicao senha={en.senha} detalhe="a fila já começou. sem previsão de tempo agora." />
          <TextoSuave>
            {sit.presente ? "você está na unidade. fique de olho na TV." : "a gente avisa quando estiver perto."}
          </TextoSuave>
        </>
      );
    case "venha":
      return (
        <>
          <Posicao senha={en.senha} detalhe="você é o próximo" />
          <TextoSuave>venha agora. ao chegar, leia o QR da TV para ser chamado.</TextoSuave>
        </>
      );
    case "recepcao":
      return (
        <>
          <Posicao senha={en.senha} detalhe="mostre esta senha e um documento com foto" />
          <TextoSuave>
            passe na recepção para conferir seus documentos. só na primeira vez; depois, é só ler o QR.
          </TextoSuave>
        </>
      );
    case "concluida":
      return <TextoSuave>atendimento concluído. obrigado por esperar em casa, cuide-se!</TextoSuave>;
    case "remanejada":
      return (
        <TextoSuave>a sua vez não chegou hoje. você continua neste serviço e a unidade marca outra data.</TextoSuave>
      );
    case "saiu":
      return (
        <TextoSuave>você foi chamado e não apareceu. estava na unidade e não ouviu? fale com a recepção.</TextoSuave>
      );
    case "cancelada":
      return <TextoSuave>esta inscrição foi cancelada. para ir outro dia, faça uma nova inscrição.</TextoSuave>;
    default:
      return null;
  }
}

const Destaque = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ fontFamily: FONTE.extra, fontSize: 24, lineHeight: 30, color: COR.ink }}>{children}</Text>
);

/** Senha e posição, o maior texto do cartão. */
function Posicao({ senha, posicao, detalhe }: { senha: string | null; posicao?: number; detalhe: string }) {
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

/** Um atendimento: selo, para quem e onde, a trilha, a explicação e as ações, tudo no mesmo cartão. */
function CartaoDoAtendimento({
  en,
  sit,
  vouSair,
  aoCancelar,
}: {
  en: MinhaEntrada;
  sit: Situacao;
  vouSair: (() => void) | null;
  aoCancelar: (() => void) | null;
}) {
  const r = resumoDaEntrada(en, sit, Date.now());
  const paraOutra = en.paraMim ? null : en.pessoa.split(/\s+/)[0];
  const podeCheckIn = ["posicao", "venha", "sem_previsao"].includes(sit.tipo) && en.itemEstado === "remoto";
  return (
    <Cartao style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Selo texto={r.selo} tom={r.tom} />
        {paraOutra ? <Pequeno>para {paraOutra}</Pequeno> : null}
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontFamily: FONTE.extra, fontSize: 22, lineHeight: 28, color: COR.ink }}>
          {en.servico.toLowerCase()}
        </Text>
        <Pequeno>
          {en.unidade}
          {quando(en)}
        </Pequeno>
      </View>
      {r.etapa !== null && r.etapa < 4 ? <Trilha etapa={r.etapa} pendente={!r.naFila && r.etapa > 0} /> : null}
      <Explicacao en={en} sit={sit} />
      {sit.tipo === "recepcao" ? (
        <Botao texto="ler o QR de novo" tipo="secundario" onPress={() => router.push("/check-in")} />
      ) : null}
      {podeCheckIn ? <Botao texto="cheguei na unidade" onPress={() => router.push("/check-in")} /> : null}
      {(sit.tipo === "posicao" || sit.tipo === "sem_previsao") && sit.presente ? (
        vouSair ? (
          <Botao texto="vou sair um pouco" tipo="secundario" onPress={vouSair} />
        ) : (
          <Carregando />
        )
      ) : null}
      {aoCancelar ? <LinkBotao texto="não vou poder ir" cor={COR.dangerInk} onPress={aoCancelar} /> : null}
    </Cartao>
  );
}

const SECOES: { id: "hoje" | "proximos" | "sem_data" | "encerrados"; titulo: string }[] = [
  { id: "hoje", titulo: "hoje" },
  { id: "proximos", titulo: "próximos" },
  { id: "sem_data", titulo: "sem data marcada" },
  { id: "encerrados", titulo: "encerrados" },
];

/** Minha fila (T3.4): consulta a cada ~3 s enquanto está na frente (PD-33). */
export default function MinhaFila() {
  const s = useSessao();
  const [entradas, setEntradas] = useState<MinhaEntrada[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [vistas, setVistas] = useState<string[]>(() => [...VEZES_VISTAS]);
  const [saindo, setSaindo] = useState<string | null>(null);
  const [cancelar, setCancelar] = useState<{ en: MinhaEntrada; sit: Situacao; ctx: string } | null>(null);
  // Texto da faixa depois do "não vou poder ir" (depende de ser reserva, lista ou vaga).
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

  const tentarDeNovo = async () => {
    setTentando(true);
    await buscarAgora.current?.();
    setTentando(false);
  };

  const agora = Date.now();
  const lista = (entradas ?? []).map((en) => ({ en, sit: situacaoDaEntrada(en, agora) }));
  const vez = lista.find(
    (x): x is { en: MinhaEntrada; sit: Extract<Situacao, { tipo: "vez" }> } =>
      x.sit.tipo === "vez" && !vistas.includes(`${x.en.entradaId}:${x.en.chamada?.em}`),
  );
  if (vez)
    return (
      <SuaVez
        senha={vez.sit.senha}
        estacao={vez.sit.estacao}
        fechar={() => {
          const chave = `${vez.en.entradaId}:${vez.en.chamada?.em}`;
          VEZES_VISTAS.add(chave);
          setVistas([...vistas, chave]);
        }}
      />
    );

  return (
    <Tela voltar={false} rodape={<Abas atual="hoje" />}>
      <View style={{ gap: 2 }}>
        {s.conta ? <TextoSuave>olá, {primeiroNome(s.conta.nome)}</TextoSuave> : null}
        <Titulo>minha fila</Titulo>
      </View>
      {erro ? (
        <Faixa
          tipo="perigo"
          titulo={erro.titulo}
          texto={erro.texto}
          acao={{ texto: "tentar de novo", onPress: () => void tentarDeNovo(), carregando: tentando }}
        />
      ) : null}
      {s.avisos && s.avisos.tipo !== "ligados" ? (
        <Faixa
          tipo="aviso"
          titulo="os avisos estão desligados"
          texto={
            s.avisos.tipo === "desligados" && !s.avisos.podePedir
              ? "sem eles, você só sabe a hora de sair com o app aberto. ligue nos ajustes do celular, em notificações."
              : "sem eles, você só sabe a hora de sair com o app aberto."
          }
          acao={{
            texto: s.avisos.tipo === "desligados" && !s.avisos.podePedir ? "abrir os ajustes" : "ligar os avisos",
            onPress: () => void s.ligarAvisos(),
          }}
        />
      ) : null}
      {cancelada ? <Faixa tipo="ok" titulo="pronto, inscrição cancelada" texto={cancelada} /> : null}
      {entradas === null && !erro ? <Carregando texto="buscando a sua fila…" /> : null}
      {entradas?.length === 0 ? (
        <Cartao style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <Mascote tamanho={120} />
          <Destaque>nenhum atendimento ainda</Destaque>
          <TextoSuave style={{ textAlign: "center" }}>
            escolha um atendimento na agenda da unidade. depois, ele aparece aqui.
          </TextoSuave>
          <View style={{ alignSelf: "stretch" }}>
            <Botao texto="ver a agenda" onPress={() => router.replace("/agenda")} />
          </View>
        </Cartao>
      ) : null}
      {SECOES.map((secao) => {
        const daSecao = lista.filter(({ en, sit }) => resumoDaEntrada(en, sit, agora).grupo === secao.id);
        if (daSecao.length === 0) return null;
        return (
          <View key={secao.id} style={{ gap: 12 }}>
            <Text style={{ fontFamily: FONTE.extra, fontSize: 18, color: COR.inkMuted }}>{secao.titulo}</Text>
            {daSecao.map(({ en, sit }) => (
              <CartaoDoAtendimento
                key={en.entradaId}
                en={en}
                sit={sit}
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
                            // Posição e previsão novas já, sem esperar a próxima consulta.
                            void buscarAgora.current?.();
                          })
                          .catch((err) => Alert.alert("não deu certo", mensagemDoErro(err)))
                          .finally(() => setSaindo(null));
                      }
                }
              />
            ))}
          </View>
        );
      })}
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
      <Espaco />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <LinkBotao texto="trocar município" cor={COR.inkMuted} onPress={() => router.push("/municipio")} />
        <LinkBotao
          texto="sair"
          cor={COR.inkMuted}
          onPress={async () => {
            await s.sair();
            router.replace("/boas-vindas");
          }}
        />
      </View>
    </Tela>
  );
}
