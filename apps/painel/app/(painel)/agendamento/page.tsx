"use client";

import type { AlocacaoDaSessao, ItemDeLigacao, ListaDeEsperaDoServico } from "@fila-saude/schemas/fila";
import { useEffect, useState } from "react";
import { BarrasDeVagas } from "@/components/agendamento/barras-de-vagas";
import { ListaDeLigacao } from "@/components/agendamento/lista-de-ligacao";
import { Sugestao } from "@/components/agendamento/sugestao";
import type { Resposta } from "@/components/agendamento/tipos";
import { VagasDaSessao } from "@/components/agendamento/vagas-da-sessao";
import { useConfirmar } from "@/components/dialogos";
import { Aviso, PainelLateral, Selecao } from "@/components/formulario";
import { CabecalhoDaPagina } from "@/components/pagina";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { ItemDeLista } from "@/components/ui/item-de-lista";
import { Segmentado } from "@/components/ui/segmentado";
import { quandoNoFuso, resumoDasPendencias } from "@/lib/agendamento";
import { ErroDaApi } from "@/lib/api";
import { useApi } from "@/lib/api-context";
import { mensagemDoErro } from "@/lib/formularios/erros";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const MAX_NO_SEGMENTADO = 4;

/**
 * Agendamento (T5.3, T5.4), caminho A do design system: as sessões privadas à esquerda, a sessão
 * escolhida à direita (vagas, alocados e a sugestão) e, no topo, quem falta ligar. Inspiração: o
 * gestor de pedidos do iFood — bater o olho e saber o que fazer agora.
 */
export default function Agendamento() {
  const api = useApi();
  const confirmar = useConfirmar();
  const {
    unidades,
    atual,
    escolher,
    erro: erroDasUnidades,
    unidade,
  } = useUnidadeAtual(["alocar_confirmar_recusar_pelo_paciente"]);
  const fuso = unidade?.fuso ?? "America/Sao_Paulo";
  const lista = useConsulta<ListaDeEsperaDoServico[]>(
    atual ? `/v1/painel/unidades/${atual}/lista-espera` : null,
    30_000,
  );
  const ligacao = useConsulta<ItemDeLigacao[]>(atual ? `/v1/painel/unidades/${atual}/ligacao` : null, 30_000);
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const alocacao = useConsulta<AlocacaoDaSessao>(sessaoId ? `/v1/painel/sessoes/${sessaoId}/alocacao` : null, 10_000);
  const [aviso, setAviso] = useState<{ texto: string; tipo: "erro" | "ok" } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verLigacao, setVerLigacao] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const servicos = (lista.dado ?? []).filter((s) => s.servico.modo !== "regulado");
  const servico = servicos.find((s) => s.servico.id === servicoId) ?? null;

  // Primeiro o serviço com mais alertas; depois a primeira sessão. Trocar de unidade recomeça.
  useEffect(() => {
    if (!lista.dado || servicos.some((s) => s.servico.id === servicoId)) return;
    setServicoId([...servicos].sort((a, b) => b.alertas - a.alertas)[0]?.servico.id ?? null);
  }, [lista.dado, servicos, servicoId]);
  useEffect(() => {
    if (!servico) return setSessaoId(null);
    if (servico.sessoes.some((s) => s.id === sessaoId)) return;
    setSessaoId(servico.sessoes[0]?.id ?? null);
  }, [servico, sessaoId]);

  function atualizarTudo() {
    alocacao.recarregar();
    ligacao.recarregar();
    lista.recarregar();
  }

  async function alocar(entradaId: string, nome: string) {
    setEnviando(true);
    try {
      alocacao.setDado(await api.post<AlocacaoDaSessao>(`/v1/painel/sessoes/${sessaoId}/alocar`, { entradaId }));
      setAviso({ texto: `${nome} alocada. O app pede a confirmação; se não responder, ligue.`, tipo: "ok" });
      ligacao.recarregar();
      lista.recarregar();
    } catch (e) {
      // I7: outro agendador mexeu antes; a resposta traz a vista atualizada.
      const nova = e instanceof ErroDaApi ? (e.dados?.alocacao as AlocacaoDaSessao | undefined) : undefined;
      if (nova) alocacao.setDado(nova);
      setAviso({ texto: mensagemDoErro(e), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  }

  async function responder(entradaId: string, nome: string, resposta: Resposta) {
    if (
      resposta === "recusou" &&
      !(await confirmar({
        titulo: `${nome} recusou?`,
        descricao: "A vaga fica livre e a pessoa volta para a lista com a data de entrada de antes.",
        acao: "Registrar recusa",
        perigo: true,
      }))
    )
      return;
    setEnviando(true);
    try {
      await api.post(`/v1/painel/entradas/${entradaId}/resposta`, { resposta });
      const textos: Record<Resposta, string> = {
        confirmou: `${nome} confirmou.`,
        recusou: "Recusa registrada. A vaga está livre.",
        sem_contato: "Tentativa anotada. Tente de novo mais tarde.",
      };
      setAviso({ texto: textos[resposta], tipo: "ok" });
      atualizarTudo();
    } catch (e) {
      setAviso({ texto: mensagemDoErro(e), tipo: "erro" });
    } finally {
      setEnviando(false);
    }
  }

  const pendencias = resumoDasPendencias(ligacao.dado ?? [], agora);
  const [destaque, ...resto] = pendencias ? pendencias.texto.split(" · ") : [];
  const d = alocacao.dado;
  const opcoesDeServico = servicos.map((s) => ({
    id: s.servico.id,
    rotulo: `${s.servico.nome} · ${s.aguardando}${s.alertas > 0 ? ` · ${s.alertas} alerta${s.alertas > 1 ? "s" : ""}` : ""}`,
  }));

  return (
    <div className="flex w-full flex-col gap-5">
      <CabecalhoDaPagina
        titulo="Agendamento"
        descricao={[unidade?.nome, servico?.servico.nome].filter(Boolean).join(" · ") || "Lista de espera"}
        acoes={
          servicos.length > MAX_NO_SEGMENTADO ? (
            <Selecao
              className="w-72"
              valor={servicoId ?? ""}
              aoMudar={(id) => id && setServicoId(id)}
              opcoes={opcoesDeServico.map((o) => ({ valor: o.id, rotulo: o.rotulo }))}
            />
          ) : servicos.length > 1 ? (
            <Segmentado rotulo="Serviço" opcoes={opcoesDeServico} atual={servicoId ?? ""} mudar={setServicoId} />
          ) : null
        }
      />
      {unidades.length > 1 ? (
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
      ) : null}
      <Aviso texto={aviso?.texto ?? lista.erro ?? alocacao.erro ?? ligacao.erro} tipo={aviso?.tipo ?? "erro"} />

      {pendencias ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <span>
            <strong>{destaque}</strong> · {resto.join(" · ")}
          </span>
          <Button tamanho="compacto" variante="secundario" onClick={() => setVerLigacao(true)}>
            Ver lista de ligação
          </Button>
        </div>
      ) : null}

      {lista.dado && servicos.length === 0 ? (
        <p className="text-slate-600">Nenhum serviço com lista de espera nesta unidade.</p>
      ) : null}

      {servico ? (
        <div className="grid items-start gap-4 lg:grid-cols-[280px_1fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <h2 className="px-4 pt-4 pb-2 text-xs font-bold tracking-wide text-slate-500 uppercase">
              Sessões privadas
            </h2>
            {servico.sessoes.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-slate-600">
                Nenhuma sessão privada planejada. Crie uma em Sessões para alocar a lista.
              </p>
            ) : (
              servico.sessoes.map((s) => {
                const livres = s.vagas === null ? null : Math.max(0, s.vagas - s.ocupadas);
                return (
                  <ItemDeLista key={s.id} selecionado={s.id === sessaoId} onClick={() => setSessaoId(s.id)}>
                    <span className="font-bold text-slate-900">{quandoNoFuso(s.inicio, fuso)}</span>
                    {s.profissional ? <span className="text-sm text-slate-500">{s.profissional}</span> : null}
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <BarrasDeVagas
                        vagas={s.vagas}
                        ocupadas={s.ocupadas}
                        confirmadas={s.confirmadas}
                        pendentes={s.pendentes}
                      />
                      <span className="text-xs text-slate-500">
                        {livres === null ? "" : livres === 1 ? "1 livre" : `${livres} livres`}
                      </span>
                    </span>
                  </ItemDeLista>
                );
              })
            )}
          </section>
          <div className="flex flex-col gap-4">
            {d ? (
              <>
                <VagasDaSessao d={d} fuso={fuso} enviando={enviando} responder={responder} />
                <Sugestao d={d} enviando={enviando} alocar={alocar} />
              </>
            ) : servico.sessoes.length > 0 ? (
              <p className="text-slate-600">Carregando a sessão…</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <PainelLateral
        aberto={verLigacao}
        aoFechar={() => setVerLigacao(false)}
        titulo="Lista de ligação"
        descricao="Quem foi alocado e ainda não respondeu, pela sessão mais próxima. Ligue e registre a resposta."
      >
        <ListaDeLigacao itens={ligacao.dado ?? []} fuso={fuso} enviando={enviando} responder={responder} />
      </PainelLateral>
    </div>
  );
}
