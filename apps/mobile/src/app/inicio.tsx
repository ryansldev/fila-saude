import type { MinhaEntrada } from "@fila-saude/schemas/fila";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Abas,
  Botao,
  Cartao,
  CartaoPosicao,
  COR,
  Espaco,
  Faixa,
  FONTE,
  LinkBotao,
  Logo,
  Mascote,
  Pequeno,
  Tela,
  Texto,
  TextoSuave,
  Titulo,
} from "@/components/ui";
import { INTERVALO_DA_CONSULTA_MS } from "@/lib/config";
import { diaCurto, ehHoje, hora } from "@/lib/datas";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro, mensagemDoErro, type Situacao, situacaoDaEntrada } from "@/lib/textos";

// "hoje" só quando a sessão é hoje no fuso da unidade; senão, o dia.
const quando = (en: MinhaEntrada) =>
  en.sessao ? (ehHoje(en.sessao.inicio, Date.now()) ? " · hoje" : ` · ${diaCurto(en.sessao.inicio)}`) : "";
const contexto = (en: MinhaEntrada, dono: string | undefined) =>
  `${en.unidade} · ${en.servico.toLowerCase()}${quando(en)}${dono && en.pessoa !== dono ? ` · para ${en.pessoa}` : ""}`;
const faltam = (posicao: number, minutos: number) =>
  minutos <= 0 || posicao <= 1 ? "você é o próximo" : `cerca de ${minutos} min para a sua vez`;

// "é a sua vez" dispensado não volta ao trocar de aba (a tela remonta); vale enquanto o app está aberto.
const VEZES_VISTAS = new Set<string>();

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

function Bloco({
  en,
  sit,
  dono,
  vouSair,
}: {
  en: MinhaEntrada;
  sit: Situacao;
  dono: string | undefined;
  vouSair: (() => void) | null;
}) {
  const ctx = contexto(en, dono);
  const naUnidade = <Botao texto="estou na unidade" onPress={() => router.push("/check-in")} />;
  switch (sit.tipo) {
    case "recepcao":
      return (
        <View style={{ gap: 16 }}>
          <Faixa
            tipo="aviso"
            grande
            titulo="passe na recepção"
            texto="para confirmar seus documentos. você ainda não entrou na fila da unidade."
          />
          <Cartao>
            <Pequeno>{ctx}</Pequeno>
            <Text style={{ fontFamily: FONTE.extra, fontSize: 32, lineHeight: 38, color: COR.ink, letterSpacing: 2 }}>
              {en.senha}
            </Text>
            <Pequeno>mostre a senha e um documento com foto</Pequeno>
          </Cartao>
          <TextoSuave>só na primeira vez. depois disso, é só ler o QR.</TextoSuave>
          <Botao texto="ler o QR de novo" tipo="secundario" onPress={() => router.push("/check-in")} />
        </View>
      );
    case "venha":
      return (
        <View style={{ gap: 16 }}>
          <Faixa tipo="aviso" grande titulo="venha agora" texto="o atendimento está te esperando" />
          <Cartao>
            <Texto>{ctx}</Texto>
          </Cartao>
          <TextoSuave>você é o próximo. ao chegar, leia o QR da TV para ser chamado.</TextoSuave>
          {naUnidade}
        </View>
      );
    case "posicao":
      return sit.presente ? (
        <View style={{ gap: 16 }}>
          <Faixa tipo="ok" titulo="você está na unidade" texto="fique de olho na TV e no celular." />
          <CartaoPosicao contexto={ctx} posicao={sit.posicao} detalhe={faltam(sit.posicao, sit.minutos)} />
          {vouSair ? <LinkBotao texto="vou sair um pouco" onPress={vouSair} /> : <Pequeno>um momento…</Pequeno>}
          <Pequeno>você continua na fila, no mesmo lugar. ao voltar, leia o QR de novo.</Pequeno>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <CartaoPosicao contexto={ctx} posicao={sit.posicao} detalhe={faltam(sit.posicao, sit.minutos)} />
          {sit.sair ? (
            <Faixa tipo="aviso" grande titulo="hora de sair de casa" texto="ao chegar, leia o QR da TV." />
          ) : (
            <Faixa
              tipo="info"
              titulo="pode esperar em casa"
              texto="avisamos a hora de sair. mantenha o celular por perto."
            />
          )}
          {naUnidade}
        </View>
      );
    case "aguardando":
      return (
        <View style={{ gap: 16 }}>
          <Cartao style={{ backgroundColor: COR.primary50 }}>
            <Pequeno>{ctx}</Pequeno>
            {en.senha ? (
              <Text style={{ fontFamily: FONTE.extra, fontSize: 40, color: COR.primary500 }}>{en.senha}</Text>
            ) : null}
            <Pequeno>aguardando início do atendimento</Pequeno>
          </Cartao>
          <TextoSuave>quando o atendimento começar, mostramos quanto falta.</TextoSuave>
          {en.senha ? naUnidade : null}
        </View>
      );
    case "sem_previsao":
      return (
        <View style={{ gap: 16 }}>
          <Cartao>
            <Pequeno>{ctx}</Pequeno>
            {en.senha ? (
              <Text style={{ fontFamily: FONTE.extra, fontSize: 40, color: COR.primary500 }}>{en.senha}</Text>
            ) : null}
            <Pequeno>a fila já começou. sem previsão de tempo agora.</Pequeno>
          </Cartao>
          {sit.presente ? (
            <Faixa tipo="ok" titulo="você está na unidade" texto="fique de olho na TV e no celular." />
          ) : (
            <>
              <TextoSuave>avisamos quando estiver perto da sua vez.</TextoSuave>
              {en.senha ? naUnidade : null}
            </>
          )}
        </View>
      );
    case "atrasada":
      return (
        <View style={{ gap: 16 }}>
          <Cartao>
            <Pequeno>{ctx}</Pequeno>
            <Texto>a unidade ainda não abriu a fila.</Texto>
          </Cartao>
          <TextoSuave>quando abrir, você recebe sua senha e a posição aqui.</TextoSuave>
        </View>
      );
    case "alocada":
      return (
        <Cartao>
          <Pequeno>data marcada</Pequeno>
          {en.sessao ? (
            <Text style={{ fontFamily: FONTE.extra, fontSize: 24, lineHeight: 30, color: COR.ink }}>
              {diaCurto(en.sessao.inicio)} · {hora(en.sessao.inicio)}
            </Text>
          ) : null}
          <Texto>
            {en.unidade} · {en.servico.toLowerCase()}
          </Texto>
        </Cartao>
      );
    case "confirmada":
      return (
        <View style={{ gap: 16 }}>
          <Cartao>
            <Pequeno>próximo atendimento</Pequeno>
            {en.sessao ? (
              <Text style={{ fontFamily: FONTE.extra, fontSize: 24, lineHeight: 30, color: COR.ink }}>
                {diaCurto(en.sessao.inicio)}
              </Text>
            ) : null}
            <Texto>
              {en.unidade} · {en.servico.toLowerCase()}
              {dono && en.pessoa !== dono ? ` · para ${en.pessoa}` : ""}
            </Texto>
          </Cartao>
          {en.sessao ? (
            <Faixa
              tipo="info"
              titulo={`a fila começa às ${hora(en.sessao.inicio)}`}
              texto="você pode esperar em casa. avisamos a sua posição e a hora de sair."
            />
          ) : null}
        </View>
      );
    case "reserva":
      return <Faixa tipo="aviso" titulo="você está na reserva" texto={`${ctx}. se alguém desistir, a vaga é sua.`} />;
    case "lista":
      return (
        <Cartao>
          <Pequeno>lista de espera</Pequeno>
          <Texto>
            {en.unidade} · {en.servico.toLowerCase()}
          </Texto>
          <Pequeno>a unidade marca a data e te avisa.</Pequeno>
        </Cartao>
      );
    case "concluida":
      return (
        <View style={{ gap: 12, alignItems: "center" }}>
          <Mascote tamanho={140} />
          <Titulo style={{ textAlign: "center" }}>atendimento concluído</Titulo>
          <TextoSuave style={{ textAlign: "center" }}>obrigado por esperar em casa. cuide-se!</TextoSuave>
        </View>
      );
    case "remanejada":
      return (
        <Faixa tipo="aviso" titulo="sua vez não chegou hoje" texto="você continua na lista e recebe outra data." />
      );
    case "saiu":
      return (
        <View style={{ gap: 12 }}>
          <Faixa tipo="perigo" titulo="você saiu da fila de hoje" texto="você foi chamado e não apareceu." />
          <TextoSuave>estava na unidade e não ouviu? fale com a recepção.</TextoSuave>
        </View>
      );
    case "cancelada":
      return <Faixa tipo="perigo" titulo="inscrição cancelada" texto={ctx} />;
    default:
      return null;
  }
}

/** Minha fila (T3.4): consulta a cada ~3 s enquanto está na frente (PD-33). */
export default function MinhaFila() {
  const s = useSessao();
  const [entradas, setEntradas] = useState<MinhaEntrada[] | null>(null);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);
  const [vistas, setVistas] = useState<string[]>(() => [...VEZES_VISTAS]);
  const [saindo, setSaindo] = useState<string | null>(null);

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
          .catch((err) => ativo && setErro(avisoDoErro(err)));
      void buscar();
      const id = setInterval(buscar, INTERVALO_DA_CONSULTA_MS);
      return () => {
        ativo = false;
        clearInterval(id);
      };
    }, [s.api, s.municipio]),
  );

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
    <Tela voltar={false} rodape={<Abas atual="fila" />}>
      <Titulo>minha fila</Titulo>
      {erro ? <Faixa tipo="perigo" titulo={erro.titulo} texto={erro.texto} /> : null}
      {entradas?.length === 0 ? (
        <>
          <Texto>você não tem atendimento marcado.</Texto>
          <Botao texto="ver próximos atendimentos" onPress={() => router.replace("/agenda")} />
        </>
      ) : null}
      {lista.map(({ en, sit }) =>
        sit.tipo === "vez" ? (
          <Faixa
            key={en.entradaId}
            tipo="ok"
            grande
            titulo="é a sua vez!"
            texto={`vá para ${sit.estacao ? sit.estacao.toLowerCase() : "a sala indicada na TV"} com a senha ${sit.senha}`}
          />
        ) : (
          <Bloco
            key={en.entradaId}
            en={en}
            sit={sit}
            dono={s.conta?.nome}
            vouSair={
              saindo === en.entradaId
                ? null
                : () => {
                    // RN-PRES-02: volta a remoto mantendo a posição; um toque por vez.
                    setSaindo(en.entradaId);
                    s.api
                      .post(`/v1/municipios/${s.municipio}/entradas/${en.entradaId}/vou-sair`)
                      .then(() =>
                        setEntradas((l) =>
                          (l ?? []).map((x) => (x.entradaId === en.entradaId ? { ...x, itemEstado: "remoto" } : x)),
                        ),
                      )
                      .catch((err) => Alert.alert("não deu certo", mensagemDoErro(err)))
                      .finally(() => setSaindo(null));
                  }
            }
          />
        ),
      )}
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
