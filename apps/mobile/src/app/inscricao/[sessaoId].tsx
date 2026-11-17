import { alternarOpcao } from "@fila-saude/domain";
import type { InscricaoEntrada, MinhaEntrada, Relacao, SessaoDaAgenda } from "@fila-saude/schemas/fila";
import { mascararCpf, mascararData } from "@fila-saude/schemas/mascaras";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Building2, CalendarDays, Lock, Stethoscope, Timer, UserRound } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import {
  BalaoDoLino,
  Botao,
  BotaoLigar,
  Campo,
  Carregando,
  COR,
  Faixa,
  FONTE,
  Mascote,
  Opcao,
  Pequeno,
  Pilula,
  Selo,
  Tela,
  Texto,
  TextoSuave,
  Titulo,
} from "@/components/ui";
import { ErroDaApi } from "@/lib/api";
import { nomeProprio, primeiroNome } from "@/lib/conta";
import { diaCurto } from "@/lib/datas";
import {
  declaracao,
  type ErroDaVerificacao,
  envioDaInscricao,
  erroDaVerificacao,
  type FimDaInscricao,
  modoDaInscricao,
  outraPessoaJaInscrita,
  type PassoDaPessoa,
  paraMimNoServico,
  RELACOES,
  telaDoErro,
  tituloDoPronto,
} from "@/lib/inscricoes";
import {
  completas,
  desfechoDoQuestionario,
  falaDaPergunta,
  PERGUNTAS,
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
  /** Outra pessoa: um dado por tela e, por fim, a relação com a declaração (2026-11-16). */
  | { tipo: "pessoa"; dado: PassoDaPessoa }
  /** Antes do questionário: "agora umas perguntinhas rápidas". */
  | { tipo: "intro" }
  | { tipo: "pergunta"; indice: number }
  | { tipo: "emergencia" }
  | { tipo: "apoio" }
  | { tipo: "inscrito" }
  | { tipo: "reserva" }
  /** Serviço com requisição: inscrito, mas o pedido médico ainda precisa chegar à unidade. */
  | { tipo: "pedido" }
  /** T5.1: entrou na lista de espera do serviço (modo "lista"). */
  | { tipo: "lista" }
  /** RN-RISCO-03: respostas novas salvas (modo "refazer"). */
  | { tipo: "refeito"; nivel: string };

type DadosDaSessao = { servicoId?: string; servico?: string; unidade?: string; inicio?: string; aberta?: boolean };

const irParaMinhaFila = () => router.dismissTo("/inicio");
const irParaAgenda = () => router.dismissTo("/unidades");

/** T3.3: "para quem é?" (AD-018), questionário v1 e a inscrição, como no design do app. */
export default function Inscricao() {
  const p = useLocalSearchParams<{
    sessaoId: string;
    servicoId?: string;
    servico?: string;
    unidade?: string;
    inicio?: string;
    aberta?: string;
    /** Modo "refazer": a entrada, a data de nascimento de quem é atendido e se é a própria conta. */
    entradaId?: string;
    nascimento?: string;
    paraMim?: string;
  }>();
  const s = useSessao();
  // "lista" e "refazer" no lugar do id da sessão: a mesma tela entra na lista ou refaz o questionário.
  const modo = modoDaInscricao(p.sessaoId);
  const envio = envioDaInscricao(modo, s.municipio ?? "", p);
  const [passo, setPasso] = useState<Passo>(modo === "refazer" ? { tipo: "pergunta", indice: 0 } : { tipo: "quem" });
  const [quem, setQuem] = useState<"eu" | "outra" | null>(modo === "refazer" && p.paraMim !== "1" ? "outra" : "eu");
  const [outra, setOutra] = useState({ nome: "", nascimento: "", cpf: "" });
  const [relacao, setRelacao] = useState<Relacao | null>(null);
  const [declarou, setDeclarou] = useState(false);
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
  const temTudo = Boolean(p.servicoId && p.servico && p.unidade && (modo !== "sessao" || p.inicio));
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
  const nascimento =
    modo === "refazer" ? (p.nascimento ?? "") : quem === "eu" ? (s.conta?.nascimento ?? "") : dataIso(outra.nascimento);

  const paraQuem = (q: "eu" | "outra"): InscricaoEntrada["paraQuem"] =>
    q === "eu"
      ? { tipo: "eu" }
      : {
          tipo: "outra",
          nome: outra.nome.trim(),
          nascimento: dataIso(outra.nascimento),
          cpf: outra.cpf.trim() ? outra.cpf : null,
          relacao: relacao ?? "responsavel_legal",
          declarou: true,
        };

  async function enviar() {
    if (!completas(r) || enviandoRef.current || !quem) return;
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    const corpo: InscricaoEntrada | { respostas: RespostasDoApp } =
      modo === "refazer" ? { respostas: r } : { paraQuem: paraQuem(quem), respostas: r };
    try {
      const res = await s.api.post<{ estado?: string; classificacao: { nivel: string } }>(envio.enviar, corpo);
      if (modo === "refazer") return setPasso({ tipo: "refeito", nivel: res.classificacao.nivel });
      if (modo === "lista") return setPasso({ tipo: "lista" });
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
      // A lista de espera não tem o "/verificar": as recusas vêm no envio, no fim do questionário.
      if (envio.verificar) await s.api.post(envio.verificar, { paraQuem: paraQuem(q) });
      setQuem(q);
      setPasso({ tipo: "intro" });
    } catch (err) {
      const e = erroDaVerificacao(err);
      setErroQuem(e);
      // Recusa de um dado da outra pessoa: volta para a tela dele, com a mensagem no campo.
      const tela = q === "outra" ? telaDoErro(e) : null;
      if (tela) setPasso({ tipo: "pessoa", dado: tela });
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

  // "para quem é" (+ os 4 passos da outra pessoa) + a apresentação + uma pergunta por tela; o resultado
  // enche a barra. Refazer vai direto às perguntas.
  const antes = modo === "refazer" ? 0 : quem === "outra" ? 6 : 2;
  const total = antes + telas.length;
  const nomeCurto = primeiroNome(outra.nome) || "a pessoa";
  const atendimento = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {sessao.servico ? <Pilula texto={sessao.servico.toLowerCase()} Icone={Stethoscope} tom="azul" /> : null}
      {sessao.unidade ? <Pilula texto={sessao.unidade} Icone={Building2} tom="azul" /> : null}
      {sessao.inicio ? <Pilula texto={diaCurto(sessao.inicio)} Icone={CalendarDays} tom="azul" /> : null}
    </View>
  );

  // Pelo link (deep link), a tela pode abrir sem conta ou sem município escolhido.
  if (s.pronto && !s.token)
    return (
      <Tela
        voltar={false}
        acoes={
          <>
            <Botao texto="entrar" onPress={() => router.replace("/entrar")} />
            <Botao variante="texto" texto="criar conta" onPress={() => router.replace("/boas-vindas")} />
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

  const FINS: Record<string, FimDaInscricao> = {
    lista: "lista",
    refeito: "refeito",
    inscrito: "inscrito",
    reserva: "reserva",
    pedido: "pedido",
  };
  const fim = FINS[passo.tipo];
  if (fim) {
    const t = tituloDoPronto(fim, quem, nomeCurto);
    const depois: Record<FimDaInscricao, string | null> = {
      inscrito: sessao.aberta
        ? "a fila de hoje já começou: a senha e a posição já estão em minha fila."
        : "não precisa confirmar. no dia, a gente avisa quando a fila começar e a hora de sair de casa.",
      lista:
        "a unidade marca a data e avisa aqui. aí é só confirmar. quem tem mais urgência ou prioridade pela lei é chamado antes.",
      reserva: "se alguém desistir, a vaga passa para a reserva e avisamos na hora.",
      pedido: "a inscrição está feita. a vaga só fica garantida quando a unidade receber o pedido.",
      refeito:
        passo.tipo === "refeito" && passo.nivel === "urgente"
          ? "pela resposta, a equipe vai olhar o caso com prioridade."
          : null,
    };
    return (
      <Tela
        progresso={{ atual: total, total }}
        aoVoltar={irParaMinhaFila}
        acoes={<Botao texto="ver minha fila" onPress={irParaMinhaFila} />}
      >
        <View style={{ alignItems: "center", gap: 4 }}>
          <Mascote tamanho={160} moldura={false} />
          <Titulo style={{ textAlign: "center" }}>{t.titulo}</Titulo>
          <Texto style={{ textAlign: "center" }}>{t.texto}</Texto>
        </View>
        {fim !== "refeito" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {sessao.servico ? <Pilula texto={sessao.servico.toLowerCase()} Icone={Stethoscope} tom="azul" /> : null}
            {sessao.inicio ? <Pilula texto={diaCurto(sessao.inicio)} Icone={CalendarDays} tom="azul" /> : null}
            {sessao.unidade ? <Pilula texto={sessao.unidade} Icone={Building2} tom="azul" /> : null}
            {quem === "outra" ? <Pilula texto={nomeProprio(outra.nome)} Icone={UserRound} tom="azul" /> : null}
          </View>
        ) : null}
        {depois[fim] ? <TextoSuave style={{ textAlign: "center" }}>{depois[fim]}</TextoSuave> : null}
      </Tela>
    );
  }

  if (passo.tipo === "emergencia")
    return (
      <Tela
        voltar={false}
        fundo={COR.dangerBg}
        acoes={
          <>
            <BotaoLigar texto="ligar 192 · SAMU" numero="192" variante="perigo" />
            <Botao
              texto="voltar às perguntas"
              variante="secundario"
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
            <BotaoLigar texto="ligar 192 · SAMU" numero="192" variante="secundario" />
            <Botao
              variante="texto"
              texto="continuar a inscrição"
              onPress={() => setPasso({ tipo: "pergunta", indice: 1 })}
            />
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

  // Recusa da API que é de um campo: aparece embaixo dele.
  const erroCpfDaApi = erroQuem?.tipo === "campo" ? erroQuem.texto : undefined;
  const erroPessoaDaApi = erroQuem?.tipo === "pessoa" ? erroQuem.texto : undefined;
  const faixaDaApi =
    erroQuem?.tipo === "faixa" ? <Faixa tipo="perigo" titulo={erroQuem.titulo} texto={erroQuem.texto} /> : null;
  const saidaDaApi =
    erroQuem?.tipo === "faixa" && erroQuem.saida ? (
      <Botao
        texto={erroQuem.saida === "agenda" ? "ver os atendimentos" : "ver minha fila"}
        onPress={erroQuem.saida === "agenda" ? irParaAgenda : irParaMinhaFila}
      />
    ) : null;

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
    const contaPronta = escolhido === "outra" || (escolhido === "eu" && Boolean(s.conta?.nascimento));
    // Sem as inscrições da conta, só deixa seguir se a busca falhou (a API ainda recusa a duplicada).
    const pode = contaPronta && (carregado || erroAoCarregar !== null);
    return (
      <Tela
        progresso={{ atual: 1, total }}
        // Aberta pelo link, não há tela anterior: o X leva aos atendimentos.
        aoVoltar={() => (router.canGoBack() ? router.back() : router.replace("/unidades"))}
        acoes={
          saidaDaApi ?? (
            <Botao
              texto="continuar"
              desativado={!pode}
              carregando={verificando}
              onPress={() => {
                if (escolhido === "eu") void verificarQuem("eu");
                else if (escolhido === "outra") setPasso({ tipo: "pessoa", dado: "nome" });
              }}
            />
          )
        }
      >
        <BalaoDoLino texto="oi! esse atendimento é para quem?" />
        {atendimento}
        {/* No alto, para ser vista sem rolar: o botão de baixo vira a saída. */}
        {faixaDaApi}
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
                <Selo texto="inscrito" tom="verde" />
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
      </Tela>
    );
  }

  if (passo.tipo === "pessoa") {
    const dado = passo.dado;
    const ordem: PassoDaPessoa[] = ["nome", "nascimento", "cpf", "relacao"];
    const i = ordem.indexOf(dado);
    const ir = (d: PassoDaPessoa | undefined) => {
      setTentouQuem(false);
      setPasso(d ? { tipo: "pessoa", dado: d } : { tipo: "quem" });
    };
    const erros = erroDaOutraPessoa(outra, s.conta?.cpf);
    const repetida = outraPessoaJaInscrita(minhas, sessao.servicoId, {
      nome: outra.nome,
      nascimento: dataIso(outra.nascimento),
      cpf: outra.cpf,
    });
    const mudarOutra = (v: Partial<typeof outra>) => {
      setOutra({ ...outra, ...v });
      setErroQuem(null);
    };
    const progresso = { atual: 2 + i, total };

    if (dado === "relacao")
      return (
        <Tela
          progresso={progresso}
          aoVoltar={() => ir("cpf")}
          acoes={
            saidaDaApi ?? (
              <Botao
                texto="continuar"
                desativado={!relacao || !declarou}
                carregando={verificando}
                onPress={() => void verificarQuem("outra")}
              />
            )
          }
        >
          <BalaoDoLino texto={`e qual a sua relação com ${nomeCurto}?`} />
          {faixaDaApi}
          {RELACOES.map((rel) => (
            <Opcao
              key={rel.id}
              texto={rel.texto(nomeCurto)}
              unica
              marcada={relacao === rel.id}
              onPress={() => {
                // A declaração muda com a relação: trocar pede marcar de novo.
                if (rel.id !== relacao) setDeclarou(false);
                setRelacao(rel.id);
              }}
            />
          ))}
          {relacao ? (
            <>
              <Pequeno style={{ fontFamily: FONTE.extra, marginBottom: -6 }}>para continuar</Pequeno>
              <Opcao texto={declaracao(relacao, nomeCurto)} marcada={declarou} onPress={() => setDeclarou(!declarou)} />
            </>
          ) : null}
          <Pequeno>você recebe os avisos e leva {nomeCurto} no dia. a recepção vê que foi você quem inscreveu.</Pequeno>
        </Tela>
      );

    const campo = {
      nome: {
        fala: "qual é o nome da pessoa que vai ser atendida?",
        rotulo: "nome da pessoa",
        valor: outra.nome,
        mudar: (t: string) => mudarOutra({ nome: t }),
        erro: erroPessoaDaApi ?? (tentouQuem ? erros.nome : undefined),
        extra: { autoCapitalize: "words" as const, placeholder: "nome completo" },
      },
      nascimento: {
        fala: `e quando ${nomeCurto} nasceu?`,
        rotulo: `nascimento de ${nomeCurto}`,
        valor: outra.nascimento,
        mudar: (t: string) => mudarOutra({ nascimento: mascararData(t) }),
        erro: erroPessoaDaApi ? "confira a data de nascimento." : tentouQuem ? erros.nascimento : undefined,
        extra: { keyboardType: "number-pad" as const, maxLength: 10, placeholder: "dd/mm/aaaa" },
      },
      cpf: {
        fala: `${nomeCurto} tem CPF? se não tiver, tudo bem.`,
        rotulo: `CPF de ${nomeCurto}`,
        valor: outra.cpf,
        mudar: (t: string) => mudarOutra({ cpf: mascararCpf(t) }),
        erro:
          erroCpfDaApi ??
          (tentouQuem
            ? (erros.cpf ??
              (repetida ? "esta pessoa já está inscrita neste serviço pela sua conta. veja em minha fila." : undefined))
            : undefined),
        extra: { keyboardType: "number-pad" as const, maxLength: 14, placeholder: "000.000.000-00" },
      },
    }[dado];
    const continuar = () => {
      setTentouQuem(true);
      if (erros[dado] || (dado === "cpf" && repetida)) return;
      ir(ordem[i + 1]);
    };
    return (
      <Tela
        progresso={progresso}
        aoVoltar={() => ir(ordem[i - 1])}
        acoes={
          <>
            <Botao texto="continuar" onPress={continuar} />
            {dado === "cpf" ? (
              <Botao
                variante="texto"
                texto={`${nomeCurto} não tem CPF`}
                onPress={() => {
                  mudarOutra({ cpf: "" });
                  if (
                    !outraPessoaJaInscrita(minhas, sessao.servicoId, {
                      ...outra,
                      nascimento: dataIso(outra.nascimento),
                      cpf: "",
                    })
                  )
                    ir("relacao");
                  else setTentouQuem(true);
                }}
              />
            ) : null}
          </>
        }
      >
        <Pilula texto="dados de quem vai ser atendido" Icone={UserRound} tom="azul" />
        <BalaoDoLino texto={campo.fala} />
        <Campo
          key={dado}
          rotulo={campo.rotulo}
          value={campo.valor}
          onChangeText={campo.mudar}
          erro={campo.erro}
          autoFocus
          returnKeyType="next"
          onSubmitEditing={continuar}
          {...campo.extra}
        />
      </Tela>
    );
  }

  if (passo.tipo === "intro")
    return (
      <Tela
        progresso={{ atual: antes, total }}
        aoVoltar={() => setPasso(quem === "outra" ? { tipo: "pessoa", dado: "relacao" } : { tipo: "quem" })}
        acoes={<Botao texto="vamos lá" onPress={() => setPasso({ tipo: "pergunta", indice: 0 })} />}
      >
        <BalaoDoLino
          texto={
            quem === "outra"
              ? `agora umas perguntinhas rápidas sobre ${nomeCurto}, para a unidade atender melhor.`
              : "agora umas perguntinhas rápidas, para a unidade te atender melhor."
          }
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pilula texto="1 minuto" Icone={Timer} tom="azul" />
          <Pilula texto="só a equipe da unidade vê" Icone={Lock} tom="azul" />
        </View>
      </Tela>
    );

  // Os fins já voltaram acima pelo mapa `FINS`; aqui só sobram as perguntas.
  if (passo.tipo !== "pergunta") return null;
  const tela = telas[passo.indice] as TelaDoQuestionario;
  const pergunta = PERGUNTAS[tela];
  const valor = r[tela];
  const lista = Array.isArray(valor) ? (valor as string[]) : [];
  const respondida = pergunta.multipla ? lista.length > 0 || Boolean(nenhum[tela]) : valor !== null;
  const ultima = passo.indice + 1 === telas.length;
  const fala = falaDaPergunta(tela, quem, nomeCurto === "a pessoa" ? "" : nomeCurto);

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
      progresso={{ atual: indice + 1 + antes, total }}
      aoVoltar={() => {
        setErro(null);
        if (indice === 0 && modo === "refazer") return router.canGoBack() ? router.back() : irParaMinhaFila();
        setPasso(indice > 0 ? { tipo: "pergunta", indice: indice - 1 } : { tipo: "intro" });
      }}
      acoes={
        erro?.duplicada ? (
          <Botao texto="ver minha fila" onPress={irParaMinhaFila} />
        ) : (
          <Botao
            texto={
              !ultima
                ? "continuar"
                : modo === "lista"
                  ? "entrar na lista"
                  : modo === "refazer"
                    ? "salvar respostas"
                    : "concluir inscrição"
            }
            onPress={avancar}
            desativado={!respondida}
            carregando={enviando}
          />
        )
      }
    >
      <BalaoDoLino texto={fala} />
      {/* A resposta da maioria vem primeiro (2026-11-16). */}
      {pergunta.nenhum ? (
        <>
          <Opcao texto={pergunta.nenhum} marcada={Boolean(nenhum[tela])} onPress={() => marcar("nenhum")} />
          <Pequeno style={{ textAlign: "center" }}>ou marque o que tiver</Pequeno>
        </>
      ) : null}
      {pergunta.opcoes.map(([id, texto]) => (
        <Opcao
          key={id}
          texto={texto}
          unica={!pergunta.multipla}
          marcada={pergunta.multipla ? lista.includes(id) : valor === id}
          onPress={() => marcar(id)}
        />
      ))}
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
