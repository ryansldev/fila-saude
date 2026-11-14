import { alternarOpcao } from "@fila-saude/domain";
import type { InscricaoEntrada } from "@fila-saude/schemas/fila";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import {
  Botao,
  BotaoLigar,
  Campo,
  Cartao,
  COR,
  Espaco,
  Faixa,
  FONTE,
  LinkBotao,
  Mascote,
  Opcao,
  Pequeno,
  Progresso,
  Tela,
  Texto,
  TextoSuave,
  Titulo,
} from "@/components/ui";
import { diaCurto } from "@/lib/datas";
import {
  completas,
  desfechoDoQuestionario,
  PERGUNTAS,
  RESPOSTAS_VAZIAS,
  type RespostasDoApp,
  type Tela as TelaDoQuestionario,
  telasDo,
} from "@/lib/questionario";
import { useSessao } from "@/lib/sessao";
import { mensagemDoErro } from "@/lib/textos";

type Passo =
  | { tipo: "quem" }
  | { tipo: "pergunta"; indice: number }
  | { tipo: "emergencia" }
  | { tipo: "apoio" }
  | { tipo: "inscrito" }
  | { tipo: "reserva" };

const dataIso = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

/** T3.3: "para quem é?" (AD-018), questionário v1 e a inscrição, como no design do app. */
export default function Inscricao() {
  const p = useLocalSearchParams<{ sessaoId: string; servico?: string; unidade?: string; inicio?: string }>();
  const s = useSessao();
  const [passo, setPasso] = useState<Passo>({ tipo: "quem" });
  const [quem, setQuem] = useState<"eu" | "outra">("eu");
  const [outra, setOutra] = useState({ nome: "", nascimento: "", cpf: "" });
  const [r, setR] = useState<RespostasDoApp>(RESPOSTAS_VAZIAS);
  const [nenhum, setNenhum] = useState<Partial<Record<TelaDoQuestionario, boolean>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const telas = telasDo(r);
  const nascimento = quem === "eu" ? (s.conta?.nascimento ?? "1990-01-01") : dataIso(outra.nascimento);
  const resumo = (
    <Cartao>
      {p.inicio ? (
        <Text style={{ fontFamily: FONTE.extra, fontSize: 20, color: COR.ink }}>{diaCurto(p.inicio)}</Text>
      ) : null}
      <Texto>
        {p.unidade} · {p.servico?.toLowerCase()}
      </Texto>
    </Cartao>
  );

  async function enviar() {
    if (!completas(r)) return;
    setEnviando(true);
    setErro(null);
    const corpo: InscricaoEntrada = {
      paraQuem:
        quem === "eu"
          ? { tipo: "eu" }
          : { tipo: "outra", nome: outra.nome.trim(), nascimento: dataIso(outra.nascimento), cpf: outra.cpf || null },
      respostas: r,
    };
    try {
      const res = await s.api.post<{ estado: string }>(
        `/v1/municipios/${s.municipio}/sessoes/${p.sessaoId}/inscricoes`,
        corpo,
      );
      setPasso({ tipo: res.estado === "na_reserva" ? "reserva" : "inscrito" });
    } catch (err) {
      setErro(mensagemDoErro(err));
    } finally {
      setEnviando(false);
    }
  }

  function avancar() {
    if (passo.tipo === "quem") return setPasso({ tipo: "pergunta", indice: 0 });
    if (passo.tipo !== "pergunta") return;
    if (telas[passo.indice] === "alarmes") {
      const d = desfechoDoQuestionario(r, nascimento, Date.now());
      if (d === "emergencia") return setPasso({ tipo: "emergencia" });
      if (d === "apoio") return setPasso({ tipo: "apoio" });
    }
    if (passo.indice + 1 < telas.length) return setPasso({ tipo: "pergunta", indice: passo.indice + 1 });
    void enviar();
  }

  if (passo.tipo === "inscrito")
    return (
      <Tela voltar={false}>
        <Mascote tamanho={140} />
        <Faixa tipo="ok" titulo="você está inscrito!" texto="a vaga é sua. não precisa confirmar." />
        {resumo}
        <TextoSuave>no dia, avisamos quando a fila começar e a hora de sair de casa.</TextoSuave>
        <Espaco />
        <Botao texto="ver minha fila" onPress={() => router.dismissTo("/inicio")} />
      </Tela>
    );

  if (passo.tipo === "reserva")
    return (
      <Tela voltar={false}>
        <Faixa
          tipo="aviso"
          titulo="as vagas acabaram"
          texto="você está na lista de reserva desta data."
          style={{ marginTop: 24 }}
        />
        {resumo}
        <TextoSuave>se alguém desistir, a vaga é sua e avisamos na hora.</TextoSuave>
        <Espaco />
        <Botao texto="ok" onPress={() => router.dismissTo("/inicio")} />
      </Tela>
    );

  if (passo.tipo === "emergencia")
    return (
      <Tela voltar={false} fundo={COR.dangerBg}>
        <Faixa
          tipo="perigo"
          titulo="isso pode ser uma emergência"
          texto="não espere na fila."
          style={{ backgroundColor: "#ffffff", marginTop: 24 }}
        />
        <Titulo style={{ color: COR.dangerInk }}>procure atendimento agora</Titulo>
        <Texto>ligue para o SAMU ou vá ao pronto-socorro mais perto.</Texto>
        <Espaco />
        <BotaoLigar texto="ligar 192 · SAMU" numero="192" tipo="perigoCheio" />
        <Botao
          texto="voltar às perguntas"
          tipo="secundario"
          onPress={() => setPasso({ tipo: "pergunta", indice: 0 })}
        />
      </Tela>
    );

  if (passo.tipo === "apoio")
    return (
      <Tela voltar={false}>
        <Titulo style={{ marginTop: 24 }}>você não está sozinho</Titulo>
        <Texto>conversar ajuda. o CVV atende 24 horas, de graça e em sigilo.</Texto>
        <BotaoLigar texto="ligar 188 · CVV" numero="188" />
        <BotaoLigar texto="ligar 192 · SAMU" numero="192" tipo="secundario" />
        <Espaco />
        <Pequeno>
          você também pode continuar a inscrição. a equipe da unidade vai saber que você precisa de atenção.
        </Pequeno>
        <LinkBotao texto="continuar a inscrição" onPress={() => setPasso({ tipo: "pergunta", indice: 1 })} />
      </Tela>
    );

  if (passo.tipo === "quem") {
    const pronto = quem === "eu" || (outra.nome.trim().length >= 3 && Boolean(dataIso(outra.nascimento)));
    return (
      <Tela>
        <Titulo>para quem é o atendimento?</Titulo>
        <Opcao texto="para mim" unica marcada={quem === "eu"} onPress={() => setQuem("eu")} />
        <Opcao texto="para outra pessoa" unica marcada={quem === "outra"} onPress={() => setQuem("outra")} />
        {quem === "outra" ? (
          <View style={{ gap: 12 }}>
            <Campo
              rotulo="nome de quem será atendido"
              value={outra.nome}
              onChangeText={(t) => setOutra({ ...outra, nome: t })}
            />
            <Campo
              rotulo="data de nascimento"
              placeholder="dd/mm/aaaa"
              keyboardType="number-pad"
              value={outra.nascimento}
              onChangeText={(t) => setOutra({ ...outra, nascimento: t })}
            />
            <Campo
              rotulo="CPF (se tiver)"
              keyboardType="number-pad"
              value={outra.cpf}
              onChangeText={(t) => setOutra({ ...outra, cpf: t })}
            />
            <Pequeno>você recebe os avisos e leva a pessoa no dia.</Pequeno>
          </View>
        ) : null}
        <Espaco />
        <Botao texto="continuar" onPress={avancar} desativado={!pronto} />
      </Tela>
    );
  }

  const tela = telas[passo.indice] as TelaDoQuestionario;
  const pergunta = PERGUNTAS[tela];
  const valor = r[tela];
  const lista = Array.isArray(valor) ? (valor as string[]) : [];
  const respondida = pergunta.multipla ? lista.length > 0 || Boolean(nenhum[tela]) : valor !== null;
  const ultima = passo.indice + 1 === telas.length;
  const titulo =
    tela === "grupos" && quem === "outra" ? "alguma destas se aplica a quem vai ser atendido?" : pergunta.pergunta;

  function marcar(op: string) {
    if (!pergunta.multipla)
      return setR({ ...r, [tela]: op, ...(tela === "motivo" && op !== "novo" ? { gravidade: null } : {}) });
    const nova = alternarOpcao(nenhum[tela] ? ["nenhum"] : lista, op, "nenhum");
    setNenhum({ ...nenhum, [tela]: nova.includes("nenhum") });
    setR({ ...r, [tela]: nova.filter((x) => x !== "nenhum") });
  }

  return (
    <Tela>
      <Progresso>
        pergunta {passo.indice + 1} de {telas.length}
      </Progresso>
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
      {erro ? <Faixa tipo="perigo" titulo={erro} /> : null}
      <Botao
        texto={ultima ? "concluir inscrição" : "continuar"}
        onPress={avancar}
        desativado={!respondida}
        carregando={enviando}
      />
    </Tela>
  );
}
