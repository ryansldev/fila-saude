"use client";

import type { ComandoEstacao, HojeNaUnidade, NivelRiscoApi, OperacaoEstacao } from "@fila-saude/schemas/fila";
import { ClockIcon, StethoscopeIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirmar } from "@/components/dialogos";
import { PainelDaEstacao } from "@/components/estacao/painel-da-estacao";
import { Aviso } from "@/components/formulario";
import { CabecalhoDaPagina } from "@/components/pagina";
import { CartaoDaEstacao } from "@/components/ui/cartao-da-estacao";
import { useApi } from "@/lib/api-context";
import { estacoesQueOpera } from "@/lib/fila";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { useEu } from "@/lib/sessao";
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
  const { atual } = useUnidadeAtual(["operar_chamadas"]);
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
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <CabecalhoDaPagina titulo="Estação" />
          {d?.sessao ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary">
              <StethoscopeIcon className="size-3.5" aria-hidden />
              {d.sessao.servico}
            </span>
          ) : null}
        </div>
        <CartaoDaEstacao estacoes={estacoes} atual={estacaoId} aoEscolher={escolherEstacao} />
      </div>
      <Aviso texto={aviso ?? op.erro ?? hoje.erro} />
      {hoje.dado && estacoes.length === 0 ? (
        <p className="text-gray-600">Nenhuma estação que você opere nesta unidade.</p>
      ) : null}
      {d ? (
        d.sessao === null ? (
          <div className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-4 py-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <ClockIcon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-extrabold text-slate-900">Nenhuma sessão aberta nesta estação</p>
              <p className="text-sm text-slate-600">Quando a recepção abrir a sessão, a fila aparece aqui.</p>
            </div>
          </div>
        ) : (
          <PainelDaEstacao
            op={d}
            cor={cor}
            aoEscolherCor={setCor}
            aoComando={comando}
            enviando={enviando}
            agora={agora + desvio}
          />
        )
      ) : null}
    </div>
  );
}
