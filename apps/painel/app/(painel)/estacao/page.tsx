"use client";

import type { ComandoEstacao, HojeNaUnidade, OperacaoEstacao } from "@fila-saude/schemas/fila";
import { useEffect, useState } from "react";
import { Aviso, Campo, classeDoCampo } from "@/components/formulario";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import { cronometro } from "@/lib/fila";
import { mensagemDoErro } from "@/lib/formularios/erros";
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
  const { unidades, atual, escolher } = useUnidadeAtual();
  const hoje = useConsulta<HojeNaUnidade>(atual ? `/v1/painel/unidades/${atual}/hoje` : null, 60_000);
  const [estacaoId, setEstacaoId] = useState<string | null>(null);
  const op = useConsulta<OperacaoEstacao>(estacaoId ? `/v1/painel/estacoes/${estacaoId}/operacao` : null, 3_000);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const estacoes = hoje.dado?.estacoes ?? [];
  useEffect(() => {
    if (estacoes.length === 0 || estacoes.some((e) => e.id === estacaoId)) return;
    const guardada = lerEstacao();
    setEstacaoId(estacoes.find((e) => e.id === guardada)?.id ?? estacoes[0]?.id ?? null);
  }, [estacoes, estacaoId]);

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

  async function comando(c: ComandoEstacao) {
    if (c === "nao-compareceu" && !window.confirm("Marcar que o paciente não compareceu?")) return;
    setEnviando(true);
    try {
      op.setDado(await api.post<OperacaoEstacao>(`/v1/painel/estacoes/${estacaoId}/${c}`, {}));
      setAviso(null);
    } catch (e) {
      setAviso(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const d = op.dado;
  const chamado = d?.chamado ?? null;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold text-gray-900">Estação</h1>
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} />
        {estacoes.length > 0 ? (
          <Campo rotulo="Estação">
            <select className={classeDoCampo} value={estacaoId ?? ""} onChange={(e) => escolherEstacao(e.target.value)}>
              {estacoes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} · {e.etapa === "triagem" ? "Triagem" : "Atendimento"}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
      </div>
      <Aviso texto={aviso ?? op.erro ?? hoje.erro} />
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
                  {cronometro(chamado.chamadoEm, agora)} desde a chamada
                  {chamado.toleranciaEsgotada ? ` · passou a tolerância de ${d.toleranciaMin} min` : ""}
                  {chamado.pulos > 0 ? ` · ${chamado.pulos} pulo(s)` : ""}
                </span>
              </div>
            ) : (
              <p className="text-lg text-gray-700">
                {d.aviso === "ninguem_aguardando" || d.aguardando === 0
                  ? "Ninguém aguardando na unidade no momento."
                  : "Estação livre."}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button size="lg" disabled={enviando} onClick={() => comando("chamar")}>
                Chamar próximo
              </Button>
              {chamado ? (
                <>
                  <Button size="lg" variant="outline" disabled={enviando} onClick={() => comando("rechamar")}>
                    Rechamar
                  </Button>
                  <Button size="lg" variant="success" disabled={enviando} onClick={() => comando("finalizar")}>
                    Finalizar
                  </Button>
                  <Button size="lg" variant="destructive" disabled={enviando} onClick={() => comando("nao-compareceu")}>
                    Não compareceu
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )
      ) : null}
    </div>
  );
}
