import { alternarOpcao } from "@fila-saude/domain";
import type { InscricaoEntrada, MinhaEntrada, SessaoDaAgenda } from "@fila-saude/schemas/fila";
import { mascararCpf, mascararData } from "@fila-saude/schemas/mascaras";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  Botao,
  BotaoLigar,
  Campo,
  Carregando,
  Cartao,
  COR,
  Faixa,
  FONTE,
  LinkBotao,
  Mascote,
  Opcao,
  Pequeno,
  Selo,
  Tela,
  Texto,
  TextoSuave,
  Titulo,
} from "@/components/ui";
import { ErroDaApi } from "@/lib/api";
import { diaCurto } from "@/lib/datas";
import { type ErroDaVerificacao, erroDaVerificacao, outraPessoaJaInscrita, paraMimNoServico } from "@/lib/inscricoes";
import {
  completas,
  desfechoDoQuestionario,
  PERGUNTAS,
  perguntaDe,
  RESPOSTAS_VAZIAS,
  type RespostasDoApp,
  type Tela as TelaDoQuestionario,
  telasDo,
} from "@/lib/questionario";
import { useSessao } from "@/lib/sessao";
import { avisoDoErro, mensagemDoErro } from "@/lib/textos";
import { dataIso, erroDaOutraPessoa } from "@/lib/validacao";

type Passo =
  | { tipo: "quem" }
  | { tipo: "pergunta"; indice: number }
  | { tipo: "emergencia" }
  | { tipo: "apoio" }
  | { tipo: "inscrito" }
  | { tipo: "reserva" }
  /** Serviço com requisição: inscrito, mas o pedido médico ainda precisa chegar à unidade. */
  | { tipo: "pedido" };

type DadosDaSessao = { servicoId?: string; servico?: string; unidade?: string; inicio?: string; aberta?: boolean };

const irParaMinhaFila = () => router.dismissTo("/inicio");
const irParaAgenda = () => router.dismissTo("/unidades");
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/** T3.3: "para quem é?" (AD-018), questionário v1 e a inscrição, como no design do app. */
export default function Inscricao() {
  const p = useLocalSearchParams<{
    sessaoId: string;
    servicoId?: string;
    servico?: string;
    unidade?: string;
    inicio?: string;
    aberta?: string;
  }>();
  const s = useSessao();
  const [passo, setPasso] = useState<Passo>({ tipo: "quem" });
  const [quem, setQuem] = useState<"eu" | "outra" | null>("eu");
  const [outra, setOutra] = useState({ nome: "", nascimento: "", cpf: "" });
  const [r, setR] = useState<RespostasDoApp>(RESPOSTAS_VAZIAS);
  const [nenhum, setNenhum] = useState<Partial<Record<TelaDoQuestionario, boolean>>>({});
  const [erro, setErro] = useState<{ texto: string; duplicada: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [tentouQuem, setTentouQuem] = useState(false);
  // Recusa do /verificar no passo "para quem" (antes do questionário).
  const [erroQuem, setErroQuem] = useState<ErroDaVerificacao | null>(null);
  const [verificando, setVerificando] = useState(false);
  // Dois toques no mesmo instante não mandam duas inscrições.
  const enviandoRef = useRef(false);

  // Pelo link (deep link) a tela chega só com o id da sessão: o resto vem da agenda.
  const temTudo = Boolean(p.servicoId && p.servico && p.unidade && p.inicio);
  const [daAgenda, setDaAgenda] = useState<SessaoDaAgenda | null | "fora">(null);
  // AD-032: as inscrições da conta, para não oferecer de novo o que a pessoa já tem.
  const [minhas, setMinhas] = useState<MinhaEntrada[] | null>(null);
  const [erroAoCarregar, setErroAoCarregar] = useState<{ titulo: string; texto: string } | null>(null);
  const [tentando, setTentando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [m, agenda] = await Promise.all([
        s.api.get<MinhaEntrada[]>(`/v1/municipios/${s.municipio}/minhas`),
        temTudo ? Promise.resolve(null) : s.api.get<SessaoDaAgenda[]>(`/v1/municipios/${s.municipio}/agenda`),
      ]);
      setMinhas(m);
      if (agenda) setDaAgenda(agenda.find((x) => x.id === p.sessaoId) ?? "fora");
      setErroAoCarregar(null);
    } catch (err) {
      setErroAoCarregar(avisoDoErro(err, "confira a conexão e tente de novo."));
    }
  }, [s.api, s.municipio, p.sessaoId, temTudo]);
  useEffect(() => {
    if (s.municipio) void carregar();
  }, [carregar, s.municipio]);

  const sessao: DadosDaSessao =
    daAgenda && daAgenda !== "fora"
      ? {
          servicoId: daAgenda.servico.id,
          servico: daAgenda.servico.nome,
          unidade: daAgenda.unidade.nome,
          inicio: daAgenda.inicio,
          aberta: daAgenda.estado === "aberta",
        }
      : {
          ...(p.servicoId ? { servicoId: p.servicoId } : {}),
          ...(p.servico ? { servico: p.servico } : {}),
          ...(p.unidade ? { unidade: p.unidade } : {}),
          ...(p.inicio ? { inicio: p.inicio } : {}),
          aberta: p.aberta === "1",
        };
  const donoInscrito = paraMimNoServico(minhas, sessao.servicoId);
  const carregado = minhas !== null && (temTudo || daAgenda !== null);

  const telas = telasDo(r);
  // Sem a data da conta carregada, não dá para decidir emergência/apoio pela idade: espera.
  const nascimento = quem === "eu" ? (s.conta?.nascimento ?? "") : dataIso(outra.nascimento);
  const resumo = (
    <Cartao>
      {sessao.inicio ? (
        <Text style={{ fontFamily: FONTE.extra, fontSize: 20, color: COR.ink }}>{diaCurto(sessao.inicio)}</Text>
      ) : null}
      {sessao.unidade || sessao.servico ? (
        <Texto>{[sessao.unidade, sessao.servico?.toLowerCase()].filter(Boolean).join(" · ")}</Texto>
      ) : null}
    </Cartao>
  );

  const paraQuem = (q: "eu" | "outra"): InscricaoEntrada["paraQuem"] =>
    q === "eu"
      ? { tipo: "eu" }
      : {
          tipo: "outra",
          nome: outra.nome.trim(),
          nascimento: dataIso(outra.nascimento),
          cpf: outra.cpf.trim() ? outra.cpf : null,
        };

  async function enviar() {
    if (!completas(r) || enviandoRef.current || !quem) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    const corpo: InscricaoEntrada = { paraQuem: paraQuem(quem), respostas: r };
    try {
      const res = await s.api.post<{ estado: string }>(
        `/v1/municipios/${s.municipio}/sessoes/${p.sessaoId}/inscricoes`,
        corpo,
      );
      setPasso({
        tipo:
          res.estado === "na_reserva" ? "reserva" : res.estado === "aguardando_encaminhamento" ? "pedido" : "inscrito",
      });
    } catch (err) {
      setErro({ texto: mensagemDoErro(err), duplicada: err instanceof ErroDaApi && err.erro === "duplicada" });
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  /** "para quem" → confere na API (sem gravar) o que a inscrição recusaria; só então começa o questionário. */
  async function verificarQuem(q: "eu" | "outra") {
    if (verificando) return;
    setVerificando(true);
    setErroQuem(null);
    try {
      await s.api.post(`/v1/municipios/${s.municipio}/sessoes/${p.sessaoId}/inscricoes/verificar`, {
        paraQuem: paraQuem(q),
      });
      setQuem(q);
      setPasso({ tipo: "pergunta", indice: 0 });
    } catch (err) {
      setErroQuem(erroDaVerificacao(err));
    } finally {
      setVerificando(false);
    }
  }

  function avancar() {
    if (passo.tipo !== "pergunta") return;
    if (telas[passo.indice] === "alarmes") {
      const d = desfechoDoQuestionario(r, nascimento, Date.now());
      if (d === "emergencia") return setPasso({ tipo: "emergencia" });
      if (d === "apoio") return setPasso({ tipo: "apoio" });
    }
    if (passo.indice + 1 < telas.length) return setPasso({ tipo: "pergunta", indice: passo.indice + 1 });
    void enviar();
  }

  // "para quem é" + uma pergunta por tela; o resultado enche a barra.
  const total = 1 + telas.length;

  // Pelo link (deep link), a tela pode abrir sem conta ou sem município escolhido.
  if (s.pronto && !s.token)
    return (
      <Tela
        voltar={false}
        acoes={
          <>
            <Botao texto="entrar" onPress={() => router.replace("/entrar")} />
            <LinkBotao texto="criar conta" onPress={() => router.replace("/boas-vindas")} />
          </>
        }
      >
        <Faixa
          tipo="aviso"
          titulo="entre na sua conta"
          texto="para se inscrever neste atendimento, entre no app e escolha o atendimento de novo."
          style={{ marginTop: 8 }}
        />
      </Tela>
    );
  if (s.pronto && !s.municipio) return <Redirect href="/municipio" />;
  if (!s.pronto) return <Carregando cheia />;

  if (passo.tipo === "inscrito")
    return (
      <Tela
        progresso={{ atual: total, total }}
        aoVoltar={irParaMinhaFila}
        acoes={<Botao texto="ver minha fila" onPress={irParaMinhaFila} />}
      >
        <Mascote tamanho={140} />
        {quem === "outra" ? (
          <Faixa
            tipo="ok"
            titulo={`${primeiroNome(outra.nome)} está inscrito(a)!`}
            texto="a vaga é dele(a). não precisa confirmar. você recebe os avisos."
          />
        ) : (
          <Faixa tipo="ok" titulo="você está inscrito!" texto="a vaga é sua. não precisa confirmar." />
        )}
        {resumo}
        <TextoSuave>
          {sessao.aberta
            ? `a fila de hoje já começou: ${quem === "outra" ? "a senha" : "sua senha"} e a posição já estão em minha fila.`
            : "no dia, avisamos quando a fila começar e a hora de sair de casa."}
        </TextoSuave>
      </Tela>
    );

  if (passo.tipo === "reserva")
    return (
      <Tela
        progresso={{ atual: total, total }}
        aoVoltar={irParaMinhaFila}
        acoes={<Botao texto="ok, entendi" onPress={irParaMinhaFila} />}
      >
        <Faixa
          tipo="aviso"
          titulo="as vagas acabaram"
          texto={
            quem === "outra"
              ? `${primeiroNome(outra.nome)} está na lista de reserva desta data.`
              : "você está na lista de reserva desta data."
          }
          style={{ marginTop: 8 }}
        />
        {resumo}
        <TextoSuave>se alguém desistir, a vaga é sua e avisamos na hora.</TextoSuave>
      </Tela>
    );

  if (passo.tipo === "pedido")
    return (
      <Tela
        progresso={{ atual: total, total }}
        aoVoltar={irParaMinhaFila}
        acoes={<Botao texto="ver minha fila" onPress={irParaMinhaFila} />}
      >
        <Faixa
          tipo="aviso"
          titulo="falta o pedido médico"
          texto="leve o pedido na recepção da unidade antes do dia."
          style={{ marginTop: 8 }}
        />
        {resumo}
        <TextoSuave>
          {quem === "outra"
            ? `a inscrição de ${primeiroNome(outra.nome)} está feita. a vaga só fica garantida quando a unidade receber o pedido.`
            : "a sua inscrição está feita. a vaga só fica garantida quando a unidade receber o pedido."}
        </TextoSuave>
      </Tela>
    );

  if (passo.tipo === "emergencia")
    return (
      <Tela
        voltar={false}
        fundo={COR.dangerBg}
        acoes={
          <>
            <BotaoLigar texto="ligar 192 · SAMU" numero="192" tipo="perigoCheio" />
            <Botao
              texto="voltar às perguntas"
              tipo="secundario"
              onPress={() => setPasso({ tipo: "pergunta", indice: 0 })}
            />
          </>
        }
      >
        <Faixa
          tipo="perigo"
          titulo="isso pode ser uma emergência"
          texto="não espere na fila."
          style={{ backgroundColor: "#ffffff", marginTop: 8 }}
        />
        <Titulo style={{ color: COR.dangerInk }}>procure atendimento agora</Titulo>
        <Texto>ligue para o SAMU ou vá ao pronto-socorro mais perto.</Texto>
      </Tela>
    );

  if (passo.tipo === "apoio")
    return (
      <Tela
        voltar={false}
        acoes={
          <>
            <BotaoLigar texto="ligar 188 · CVV" numero="188" />
            <BotaoLigar texto="ligar 192 · SAMU" numero="192" tipo="secundario" />
            <LinkBotao texto="continuar a inscrição" onPress={() => setPasso({ tipo: "pergunta", indice: 1 })} />
          </>
        }
      >
        <Titulo style={{ marginTop: 8 }}>você não está sozinho</Titulo>
        <Texto>conversar ajuda. o CVV atende 24 horas, de graça e em sigilo.</Texto>
        <Pequeno>
          você também pode continuar a inscrição. a equipe da unidade vai saber que você precisa de atenção.
        </Pequeno>
      </Tela>
    );

  if (passo.tipo === "quem") {
    // Pelo link, a sessão pode já ter fechado ou não ser aberta ao público.
    if (daAgenda === "fora")
      return (
        <Tela acoes={<Botao texto="ver os atendimentos" onPress={() => router.replace("/unidades")} />}>
          <Faixa
            tipo="aviso"
            titulo="este atendimento não está aberto"
            texto="as inscrições acabaram ou ele é só por agendamento da unidade."
            style={{ marginTop: 8 }}
          />
          <TextoSuave>veja os próximos atendimentos do seu município.</TextoSuave>
        </Tela>
      );

    const escolhido = quem === "eu" && donoInscrito ? null : quem;
    const errosOutra = escolhido === "outra" ? erroDaOutraPessoa(outra, s.conta?.cpf) : {};
    const outraRepetida =
      escolhido === "outra" &&
      outraPessoaJaInscrita(minhas, sessao.servicoId, {
        nome: outra.nome,
        nascimento: dataIso(outra.nascimento),
        cpf: outra.cpf,
      });
    const mostrar = (k: keyof typeof errosOutra) => (tentouQuem ? errosOutra[k] : undefined);
    // Recusa da API que é de um campo: aparece embaixo dele.
    const erroCpfDaApi = erroQuem?.tipo === "campo" ? erroQuem.texto : undefined;
    const erroPessoaDaApi = erroQuem?.tipo === "pessoa" ? erroQuem.texto : undefined;
    const mudarOutra = (v: Partial<typeof outra>) => {
      setOutra({ ...outra, ...v });
      setErroQuem(null);
    };
    const contaPronta = escolhido === "outra" || (escolhido === "eu" && Boolean(s.conta?.nascimento));
    // Sem as inscrições da conta, só deixa seguir se a busca falhou (a API ainda recusa a duplicada).
    const pode = contaPronta && (carregado || erroAoCarregar !== null) && !outraRepetida;
    return (
      <Tela
        progresso={{ atual: 1, total }}
        // Aberta pelo link, não há tela anterior: o X leva aos atendimentos.
        aoVoltar={() => (router.canGoBack() ? router.back() : router.replace("/unidades"))}
        acoes={
          erroQuem?.tipo === "faixa" && erroQuem.saida ? (
            <Botao
              texto={erroQuem.saida === "agenda" ? "ver os atendimentos" : "ver minha fila"}
              onPress={erroQuem.saida === "agenda" ? irParaAgenda : irParaMinhaFila}
            />
          ) : (
            <Botao
              texto="continuar"
              desativado={!pode}
              carregando={verificando}
              onPress={() => {
                setTentouQuem(true);
                if (escolhido && Object.keys(errosOutra).length === 0 && !outraRepetida) void verificarQuem(escolhido);
              }}
            />
          )
        }
      >
        <Titulo>para quem é o atendimento?</Titulo>
        {/* No alto, para ser vista sem rolar: o botão de baixo vira a saída. */}
        {erroQuem?.tipo === "faixa" ? <Faixa tipo="perigo" titulo={erroQuem.titulo} texto={erroQuem.texto} /> : null}
        {sessao.inicio || sessao.servico ? resumo : null}
        {erroAoCarregar ? (
          <Faixa
            tipo="perigo"
            titulo={erroAoCarregar.titulo}
            texto={erroAoCarregar.texto}
            acao={{
              texto: "tentar de novo",
              carregando: tentando,
              onPress: async () => {
                setTentando(true);
                await carregar();
                setTentando(false);
              },
            }}
          />
        ) : null}
        {!carregado && !erroAoCarregar ? (
          <Carregando texto="conferindo suas inscrições…" />
        ) : (
          <>
            {donoInscrito ? (
              <View
                accessible
                accessibilityRole="radio"
                accessibilityState={{ disabled: true, checked: false }}
                accessibilityLabel="para mim. indisponível: você já está inscrito neste serviço."
                style={{
                  gap: 8,
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: COR.linha,
                  backgroundColor: COR.surfaceMuted,
                }}
              >
                <Text style={{ fontFamily: FONTE.bold, fontSize: 18, lineHeight: 24, color: COR.inkMuted }}>
                  para mim
                </Text>
                <Selo texto="você já está inscrito" tom="verde" />
                <Pequeno>cada pessoa entra uma vez em cada serviço. sua inscrição está em minha fila.</Pequeno>
              </View>
            ) : (
              <Opcao
                texto="para mim"
                unica
                marcada={escolhido === "eu"}
                onPress={() => {
                  setQuem("eu");
                  setErroQuem(null);
                }}
              />
            )}
            <Opcao
              texto="para outra pessoa"
              unica
              marcada={escolhido === "outra"}
              onPress={() => {
                setQuem("outra");
                setErroQuem(null);
              }}
            />
          </>
        )}
        {escolhido === "outra" ? (
          <View style={{ gap: 12 }}>
            <Campo
              rotulo="nome de quem será atendido"
              value={outra.nome}
              onChangeText={(t) => mudarOutra({ nome: t })}
              autoCapitalize="words"
              erro={
                outraRepetida
                  ? "esta pessoa já está inscrita neste serviço pela sua conta. veja em minha fila."
                  : (erroPessoaDaApi ?? mostrar("nome"))
              }
            />
            <Campo
              rotulo="data de nascimento"
              placeholder="dd/mm/aaaa"
              keyboardType="number-pad"
              value={outra.nascimento}
              onChangeText={(t) => mudarOutra({ nascimento: mascararData(t) })}
              maxLength={10}
              erro={erroPessoaDaApi ? "confira a data de nascimento." : mostrar("nascimento")}
            />
            <Campo
              rotulo="CPF (se tiver)"
              keyboardType="number-pad"
              value={outra.cpf}
              onChangeText={(t) => mudarOutra({ cpf: mascararCpf(t) })}
              maxLength={14}
              placeholder="000.000.000-00"
              erro={erroCpfDaApi ?? mostrar("cpf")}
            />
            <Pequeno>você recebe os avisos e leva a pessoa no dia.</Pequeno>
          </View>
        ) : null}
      </Tela>
    );
  }

  const tela = telas[passo.indice] as TelaDoQuestionario;
  const pergunta = PERGUNTAS[tela];
  const valor = r[tela];
  const lista = Array.isArray(valor) ? (valor as string[]) : [];
  const respondida = pergunta.multipla ? lista.length > 0 || Boolean(nenhum[tela]) : valor !== null;
  const ultima = passo.indice + 1 === telas.length;
  const titulo = perguntaDe(tela, quem);

  function marcar(op: string) {
    setErro(null);
    if (!pergunta.multipla)
      return setR({ ...r, [tela]: op, ...(tela === "motivo" && op !== "novo" ? { gravidade: null } : {}) });
    const nova = alternarOpcao(nenhum[tela] ? ["nenhum"] : lista, op, "nenhum");
    setNenhum({ ...nenhum, [tela]: nova.includes("nenhum") });
    setR({ ...r, [tela]: nova.filter((x) => x !== "nenhum") });
  }

  // Voltar vai à pergunta anterior (ou a "para quem é"), sem perder as respostas.
  const indice = passo.indice;
  return (
    <Tela
      progresso={{ atual: indice + 2, total }}
      aoVoltar={() => {
        setErro(null);
        setPasso(indice > 0 ? { tipo: "pergunta", indice: indice - 1 } : { tipo: "quem" });
      }}
      acoes={
        erro?.duplicada ? (
          <Botao texto="ver minha fila" onPress={irParaMinhaFila} />
        ) : (
          <Botao
            texto={ultima ? "concluir inscrição" : "continuar"}
            onPress={avancar}
            desativado={!respondida}
            carregando={enviando}
          />
        )
      }
    >
      <Titulo>{titulo}</Titulo>
      {pergunta.multipla ? <Pequeno>marque todos que tiver.</Pequeno> : null}
      {pergunta.opcoes.map(([id, texto]) => (
        <Opcao
          key={id}
          texto={texto}
          unica={!pergunta.multipla}
          marcada={pergunta.multipla ? lista.includes(id) : valor === id}
          onPress={() => marcar(id)}
        />
      ))}
      {pergunta.nenhum ? (
        <Opcao texto={pergunta.nenhum} marcada={Boolean(nenhum[tela])} onPress={() => marcar("nenhum")} />
      ) : null}
      {tela === "grupos" && r.grupos.length > 0 ? (
        <Faixa
          tipo="info"
          titulo="vamos conferir na unidade"
          texto="leve um documento que comprove. declarar o que não é verdade pode ser crime."
        />
      ) : null}
      {erro ? (
        <Faixa
          tipo="perigo"
          titulo={erro.duplicada ? "já inscrito neste serviço" : "não deu para concluir"}
          texto={erro.texto}
        />
      ) : null}
    </Tela>
  );
}
