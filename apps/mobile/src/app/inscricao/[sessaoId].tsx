import { alternarOpcao } from "@fila-saude/domain";
import type { InscricaoEntrada } from "@fila-saude/schemas/fila";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { Botao, Campo, COR, Erro, e, Opcao, Tela } from "@/components/ui";
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
  | { tipo: "aviso" }
  | { tipo: "emergencia" }
  | { tipo: "apoio" };

const dataIso = (t: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

const ligar = (n: string) => void Linking.openURL(`tel:${n}`);

/** T3.3: "Para quem é?" (AD-018), questionário v1 e a inscrição. */
export default function Inscricao() {
  const { sessaoId, nome } = useLocalSearchParams<{ sessaoId: string; nome?: string }>();
  const s = useSessao();
  const [passo, setPasso] = useState<Passo>({ tipo: "quem" });
  const [quem, setQuem] = useState<"eu" | "outra">("eu");
  const [outra, setOutra] = useState({ nome: "", nascimento: "", cpf: "" });
  const [r, setR] = useState<RespostasDoApp>(RESPOSTAS_VAZIAS);
  const [marcouNenhum, setMarcouNenhum] = useState<Partial<Record<TelaDoQuestionario, boolean>>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const telas = telasDo(r);
  const nascimento = quem === "eu" ? (s.conta?.nascimento ?? "1990-01-01") : dataIso(outra.nascimento);

  async function enviar() {
    if (!completas(r)) return;
    setEnviando(true);
    const corpo: InscricaoEntrada = {
      paraQuem:
        quem === "eu"
          ? { tipo: "eu" }
          : { tipo: "outra", nome: outra.nome.trim(), nascimento: dataIso(outra.nascimento), cpf: outra.cpf || null },
      respostas: r,
    };
    try {
      await s.api.post(`/v1/municipios/${s.municipio}/sessoes/${sessaoId}/inscricoes`, corpo);
      router.dismissTo("/inicio");
    } catch (err) {
      setErro(mensagemDoErro(err));
    } finally {
      setEnviando(false);
    }
  }

  function avancar() {
    if (passo.tipo === "quem") return setPasso({ tipo: "pergunta", indice: 0 });
    if (passo.tipo !== "pergunta") return;
    const tela = telas[passo.indice];
    if (tela === "alarmes") {
      const d = desfechoDoQuestionario(r, nascimento, Date.now());
      if (d === "emergencia") return setPasso({ tipo: "emergencia" });
      if (d === "apoio") return setPasso({ tipo: "apoio" });
    }
    if (passo.indice + 1 < telas.length) return setPasso({ tipo: "pergunta", indice: passo.indice + 1 });
    if (r.grupos.length > 0) return setPasso({ tipo: "aviso" });
    void enviar();
  }

  if (passo.tipo === "emergencia")
    return (
      <Tela titulo="Procure atendimento agora">
        <Text style={e.texto}>
          O que você marcou pode ser uma emergência. Não espere na fila: ligue para o SAMU ou vá à emergência mais
          próxima.
        </Text>
        <Botao texto="Ligar 192 · SAMU" tipo="perigo" onPress={() => ligar("192")} />
        <Text style={e.suave}>Você não entrou na fila.</Text>
        <Botao texto="Voltar ao início" tipo="secundario" onPress={() => router.dismissTo("/inicio")} />
      </Tela>
    );

  if (passo.tipo === "apoio")
    return (
      <Tela titulo="Você não está sozinho">
        <Text style={e.texto}>Converse agora com alguém. O atendimento é gratuito, sigiloso e funciona 24 horas.</Text>
        <Botao texto="CVV · conversar agora (188)" onPress={() => ligar("188")} />
        <Botao texto="SAMU · emergência (192)" tipo="perigo" onPress={() => ligar("192")} />
        <Text style={e.suave}>Se quiser, você pode seguir e entrar na fila. Sua inscrição vai como prioridade.</Text>
        <Botao texto="Continuar" tipo="secundario" onPress={() => setPasso({ tipo: "pergunta", indice: 1 })} />
      </Tela>
    );

  if (passo.tipo === "aviso")
    return (
      <Tela titulo="Prioridade será conferida">
        <Text style={e.texto}>
          A recepção vai conferir a prioridade no dia, com documento. Se não for confirmada, você segue na fila sem ela.
        </Text>
        <Erro texto={erro} />
        <Botao texto="Entendi, confirmar inscrição" onPress={enviar} carregando={enviando} />
      </Tela>
    );

  if (passo.tipo === "quem") {
    const pronto = quem === "eu" || (outra.nome.trim().length >= 3 && Boolean(dataIso(outra.nascimento)));
    return (
      <Tela titulo={nome ? `Inscrição · ${nome}` : "Inscrição"}>
        <Text style={e.rotulo}>Para quem é o atendimento?</Text>
        <Opcao texto="Para mim" marcada={quem === "eu"} onPress={() => setQuem("eu")} />
        <Opcao texto="Para outra pessoa" marcada={quem === "outra"} onPress={() => setQuem("outra")} />
        {quem === "outra" ? (
          <View style={{ gap: 12 }}>
            <Campo rotulo="Nome completo" value={outra.nome} onChangeText={(t) => setOutra({ ...outra, nome: t })} />
            <Campo
              rotulo="Data de nascimento"
              placeholder="DD/MM/AAAA"
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
          </View>
        ) : null}
        <Botao texto="Continuar" onPress={avancar} desativado={!pronto} />
      </Tela>
    );
  }

  const tela = telas[passo.indice] as TelaDoQuestionario;
  const p = PERGUNTAS[tela];
  const valor = r[tela];
  const lista = Array.isArray(valor) ? (valor as string[]) : [];
  const respondida = p.multipla ? lista.length > 0 || Boolean(marcouNenhum[tela]) : valor !== null;

  function marcar(op: string) {
    if (!p.multipla)
      return setR({ ...r, [tela]: op, ...(tela === "motivo" && op !== "novo" ? { gravidade: null } : {}) });
    const atual = marcouNenhum[tela] ? ["nenhum"] : lista;
    const nova = alternarOpcao(atual, op, "nenhum");
    setMarcouNenhum({ ...marcouNenhum, [tela]: nova.includes("nenhum") });
    setR({ ...r, [tela]: nova.filter((x) => x !== "nenhum") });
  }

  return (
    <Tela>
      <Text style={e.suave}>
        Pergunta {passo.indice + 1} de {telas.length}
      </Text>
      <Text style={[e.titulo, { fontSize: 22 }]}>{p.pergunta}</Text>
      {p.opcoes.map(([id, texto]) => (
        <Opcao
          key={id}
          texto={texto}
          marcada={p.multipla ? lista.includes(id) : valor === id}
          onPress={() => marcar(id)}
        />
      ))}
      {p.nenhum ? (
        <Opcao texto={p.nenhum} marcada={Boolean(marcouNenhum[tela])} onPress={() => marcar("nenhum")} />
      ) : null}
      <Erro texto={erro} />
      <Botao
        texto={passo.indice + 1 === telas.length && r.grupos.length === 0 ? "Confirmar inscrição" : "Continuar"}
        onPress={avancar}
        desativado={!respondida}
        carregando={enviando}
      />
      {passo.indice > 0 ? (
        <Botao
          texto="Voltar"
          tipo="secundario"
          onPress={() => setPasso({ tipo: "pergunta", indice: passo.indice - 1 })}
        />
      ) : null}
      <Text style={[e.suave, { color: COR.suave }]}>Em caso de emergência, ligue 192.</Text>
    </Tela>
  );
}
