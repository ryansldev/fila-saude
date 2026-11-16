"use client";

import type { ComandoEstacao, HojeNaUnidade, NivelRiscoApi, OperacaoEstacao } from "@fila-saude/schemas/fila";
import { useEffect, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, Campo, Selecao } from "@/components/formulario";
import { CabecalhoDaPagina } from "@/components/pagina";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { BotaoDeEscolha } from "@/components/ui/botao-de-escolha";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { cronometro, estacoesQueOpera } from "@/lib/fila";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { useEu } from "@/lib/sessao";
import { CORES_DA_TRIAGEM, corDoNivel, podeEncaminhar, precisaClassificar, textoDaPrioridade } from "@/lib/triagem";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const CHAVE = "fila-painel:estacao";

function lerEstacao(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

/** Estação de chamada (T3.7): um paciente por vez; a tolerância só avisa (AD-006). */
export default function Estacao() {
  const api = useApi();
  const confirmar = useConfirmar();
  const { unidades, atual, escolher, erro: erroDasUnidades } = useUnidadeAtual(["operar_chamadas"]);
  const eu = useEu();
  const hoje = useConsulta<HojeNaUnidade>(atual ? `/v1/painel/unidades/${atual}/hoje` : null, 60_000);
  const [estacaoId, setEstacaoId] = useState<string | null>(null);
  const op = useConsulta<OperacaoEstacao>(estacaoId ? `/v1/painel/estacoes/${estacaoId}/operacao` : null, 3_000);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  // Cor escolhida na triagem para quem está chamado; volta a nada a cada novo chamado.
  const [cor, setCor] = useState<NivelRiscoApi | null>(null);
  const chamadoId = op.dado?.chamado?.itemId ?? null;
  useEffect(() => {
    if (chamadoId !== undefined) setCor(null);
  }, [chamadoId]);

  // PD-46: só as estações que o perfil opera nesta unidade.
  const perfis = eu.estado === "autenticado" ? eu.eu.perfis : [];
  const estacoes = atual ? estacoesQueOpera(hoje.dado?.estacoes ?? [], perfis, atual) : [];
  useEffect(() => {
    if (!hoje.dado) return;
    if (estacoes.some((e) => e.id === estacaoId)) return;
    // Outra unidade (ou estação removida): nunca continuar chamando na estação anterior.
    const guardada = lerEstacao();
    setEstacaoId(estacoes.find((e) => e.id === guardada)?.id ?? estacoes[0]?.id ?? null);
  }, [hoje.dado, estacoes, estacaoId]);

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  function escolherEstacao(id: string) {
    setEstacaoId(id);
    try {
      localStorage.setItem(CHAVE, id);
    } catch {
      // vale só nesta página
    }
  }

  async function comando(c: ComandoEstacao, encaminhar = false) {
    if (
      c === "nao-compareceu" &&
      !(await confirmar({ titulo: "Marcar que o paciente não compareceu?", acao: "Não compareceu", perigo: true }))
    )
      return;
    // H3: na triagem, quem sai do chamado sai com a cor. Vermelho vai ao 1º lugar do atendimento;
    // encaminhar à emergência é a ação à parte, com confirmação (AD-059).
    const classifica = triagem && Boolean(chamado) && (c === "chamar" || c === "finalizar");
    if (
      encaminhar &&
      !(await confirmar({
        titulo: "Encaminhar à emergência?",
        descricao: "A pessoa sai da fila de hoje desta unidade. Use quando ela precisa ir para outro serviço.",
        acao: "Encaminhar",
        perigo: true,
      }))
    )
      return;
    setEnviando(true);
    try {
      const corpo = classifica && cor ? { riscoConfirmado: cor, ...(encaminhar ? { encaminhar: true } : {}) } : {};
      op.setDado(await api.post<OperacaoEstacao>(`/v1/painel/estacoes/${estacaoId}/${c}`, corpo));
      setAviso(null);
    } catch (e) {
      setAviso(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const d = op.dado;
  // Diferença entre o relógio do servidor e o deste computador, medida na última resposta.
  const [desvio, setDesvio] = useState(0);
  useEffect(() => {
    if (d?.agora) setDesvio(Date.parse(d.agora) - Date.now());
  }, [d?.agora]);
  const chamado = d?.chamado ?? null;
  const triagem = d?.estacao.etapa === "triagem";
  const falta = d ? precisaClassificar(d.estacao.etapa, Boolean(chamado), cor) : false;
  const ficha = chamado?.triagem;
  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina titulo="Estação" descricao="Chame o próximo paciente e acompanhe quem está na sua sala." />
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
        {estacoes.length > 0 ? (
          <Campo rotulo="Estação" className="w-full sm:w-72">
            <Selecao
              className="w-full min-w-56"
              valor={estacaoId ?? ""}
              aoMudar={(id) => id && escolherEstacao(id)}
              placeholder="Escolha a estação"
              opcoes={estacoes.map((e) => ({
                valor: e.id,
                rotulo: `${e.nome} · ${e.etapa === "triagem" ? "Triagem" : "Atendimento"}`,
              }))}
            />
          </Campo>
        ) : null}
      </div>
      <Aviso texto={aviso ?? op.erro ?? hoje.erro} />
      {hoje.dado && estacoes.length === 0 ? (
        <p className="text-gray-600">Nenhuma estação que você opere nesta unidade.</p>
      ) : null}
      {d ? (
        d.sessao === null ? (
          <p className="text-gray-600">Nenhuma sessão aberta nesta estação agora.</p>
        ) : (
          <div className="flex flex-col gap-6 rounded-2xl border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-600">
              {d.sessao.servico} · {d.aguardando} aguardando na unidade · {d.remotos} a caminho
            </p>
            {chamado ? (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-gray-500">Chamado agora</span>
                <span className="font-mono text-6xl font-bold text-primary">{chamado.senha}</span>
                <span className="text-xl text-gray-900">{chamado.nome}</span>
                <span className={chamado.toleranciaEsgotada ? "text-red-700" : "text-gray-600"}>
                  {cronometro(chamado.chamadoEm, agora + desvio)} desde a chamada
                  {chamado.toleranciaEsgotada ? ` · passou a tolerância de ${d.toleranciaMin} min` : ""}
                  {chamado.pulos > 0 ? ` · ${chamado.pulos} pulo(s)` : ""}
                </span>
              </div>
            ) : null}
            {chamado && triagem && ficha ? (
              <div className="flex flex-col gap-4 border-t border-gray-100 pt-5">
                {ficha.apoio ? (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900">
                    <strong>Atenção:</strong> respondeu no app que tem pensamentos de tirar a própria vida ou de se
                    machucar. Acolha agora. CVV 188 · SAMU 192.
                  </p>
                ) : null}
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-gray-500">Sugerido pelo app</dt>
                    <dd className="text-gray-900">
                      {corDoNivel(ficha.riscoSugerido).rotulo} · {ficha.regra}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Prioridade declarada</dt>
                    <dd className="text-gray-900">{textoDaPrioridade(ficha.prioridade)}</dd>
                  </div>
                </dl>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 font-medium text-gray-900">Classificação de risco</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    {CORES_DA_TRIAGEM.map((c) => (
                      <BotaoDeEscolha
                        key={c.nivel}
                        selecionado={cor === c.nivel}
                        algumSelecionado={cor !== null}
                        onClick={() => setCor(c.nivel)}
                        className={c.classes}
                      >
                        <span className="font-bold text-lg">{c.rotulo}</span>
                        <span className="text-sm">
                          {c.descricao} · {c.tempoAlvo}
                        </span>
                        {c.nivel === ficha.riscoSugerido ? (
                          <span className="mt-1 rounded bg-white/80 px-1.5 text-gray-900 text-xs">
                            sugerido pelo app
                          </span>
                        ) : null}
                      </BotaoDeEscolha>
                    ))}
                  </div>
                </fieldset>
              </div>
            ) : null}
            {chamado ? null : (
              <p className="text-lg text-gray-700">
                {d.aviso === "ninguem_aguardando" || d.aguardando === 0
                  ? "Ninguém aguardando na unidade no momento."
                  : "Estação livre."}
              </p>
            )}
            {falta ? <p className="text-gray-600 text-sm">Escolha a cor para finalizar ou chamar o próximo.</p> : null}
            {chamado && triagem && podeEncaminhar(cor) ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900 text-sm">
                Vermelho: ao finalizar, a pessoa vai para o 1º lugar do atendimento desta unidade. Se ela precisa ir
                para outro serviço, use "Encaminhar à emergência".
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button disabled={enviando || falta} onClick={() => comando("chamar")}>
                Chamar próximo
              </Button>
              {chamado ? (
                <>
                  <Button variante="secundario" disabled={enviando} onClick={() => comando("rechamar")}>
                    Rechamar
                  </Button>
                  <Button variante="sucesso" disabled={enviando || falta} onClick={() => comando("finalizar")}>
                    Finalizar
                  </Button>
                  <Button variante="perigoContorno" disabled={enviando} onClick={() => comando("nao-compareceu")}>
                    Não compareceu
                  </Button>
                  {triagem && podeEncaminhar(cor) ? (
                    <Button variante="perigo" disabled={enviando} onClick={() => comando("finalizar", true)}>
                      Encaminhar à emergência
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
