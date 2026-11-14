"use client";

import { type FilaDaSessao, type HojeNaUnidade, presencaEntradaSchema } from "@fila-saude/schemas/fila";
import { useEffect, useState } from "react";
import { useConfirmar, usePerguntar } from "@/components/dialogos";
import { Aviso, Campo, Selecao, Tabela } from "@/components/formulario";
import { CabecalhoDaPagina, EstadoDaSessao } from "@/components/pagina";
import { SeletorDeUnidade } from "@/components/seletor-de-unidade";
import { Button } from "@/components/ui/button";
import { useApi } from "@/lib/api-context";
import {
  acoesDaFila,
  agruparFila,
  contadoresDaFila,
  rotuloDoEstado,
  textoDasPendencias,
  textoDoDocumento,
} from "@/lib/fila";
import { mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import { horarioParaTela } from "@/lib/formularios/sessao";
import { useEu } from "@/lib/sessao";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const ESTADO_DA_SESSAO: Record<string, string> = {
  planejada: "Ainda não abriu",
  aberta: "Aberta",
  encerrada: "Encerrada",
};

export default function FilaDoDia() {
  const api = useApi();
  const confirmar = useConfirmar();
  const perguntar = usePerguntar();
  const eu = useEu();
  const {
    unidades,
    atual,
    escolher,
    unidade,
    erro: erroDasUnidades,
  } = useUnidadeAtual(["abrir_cancelar_encerrar_sessao", "conferir_e_marcar_presenca", "operar_chamadas"]);
  const fuso = unidade?.fuso ?? "America/Sao_Paulo";
  const hoje = useConsulta<HojeNaUnidade>(atual ? `/v1/painel/unidades/${atual}/hoje` : null, 15_000);
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const fila = useConsulta<FilaDaSessao>(sessaoId ? `/v1/painel/sessoes/${sessaoId}/fila` : null, 3_000);
  const [aviso, setAviso] = useState<string | null>(null);

  const sessoes = hoje.dado?.sessoes ?? [];
  useEffect(() => {
    // Enquanto /hoje carrega, mantém a sessão escolhida (antes ela era trocada a cada ação).
    if (!hoje.dado) return;
    if (sessoes.length === 0) setSessaoId(null);
    else if (!sessoes.some((s) => s.id === sessaoId))
      setSessaoId((sessoes.find((s) => s.estado === "aberta") ?? sessoes[0])?.id ?? null);
  }, [hoje.dado, sessoes, sessaoId]);

  const perfis = eu.estado === "autenticado" ? eu.eu.perfis : [];
  const estado = fila.dado?.sessao.estado ?? "planejada";
  const pode = atual ? acoesDaFila(perfis, atual, estado) : { abrir: false, encerrar: false, presenca: false };

  async function agir(
    caminho: string,
    corpo: unknown,
    pergunta?: { titulo: string; descricao?: string; acao?: string; perigo?: boolean },
  ) {
    if (pergunta && !(await confirmar(pergunta))) return;
    try {
      fila.setDado(await api.post<FilaDaSessao>(caminho, corpo));
      setAviso(null);
      hoje.recarregar();
    } catch (e) {
      setAviso(mensagemDoErro(e));
    }
  }

  /** Confere o corpo com o schema da API antes de enviar a presença. */
  async function presenca(corpo: { entradaId: string; resultado: "confere" | "nao_confere"; motivo?: string }) {
    const invalidos = validarNoCliente(presencaEntradaSchema, corpo);
    if (invalidos) return setAviso(invalidos.geral ?? Object.values(invalidos.campos)[0] ?? "Confira os dados.");
    await agir(`/v1/painel/sessoes/${sessaoId}/presenca`, corpo);
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CabecalhoDaPagina
        titulo="Fila do dia"
        descricao="Quem está na fila hoje, em casa ou na unidade. Abra e encerre as sessões e confirme quem chegou."
      />
      <div className="flex flex-wrap items-end gap-4">
        <SeletorDeUnidade unidades={unidades} atual={atual} escolher={escolher} erro={erroDasUnidades} />
        {sessoes.length > 0 ? (
          <Campo rotulo="Sessão" className="w-full sm:w-96">
            <Selecao
              className="w-full min-w-72"
              valor={sessaoId ?? ""}
              aoMudar={(id) => id && setSessaoId(id)}
              placeholder="Escolha a sessão"
              opcoes={sessoes.map((s) => ({
                valor: s.id,
                rotulo: `${horarioParaTela(s.inicio, fuso).hora}–${horarioParaTela(s.fim, fuso).hora} · ${s.servico} · ${
                  ESTADO_DA_SESSAO[s.estado] ?? s.estado
                }`,
              }))}
            />
          </Campo>
        ) : null}
      </div>
      <Aviso texto={aviso ?? hoje.erro ?? fila.erro} />
      {atual && hoje.dado && sessoes.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhuma sessão hoje nesta unidade.</p>
      ) : null}
      {fila.dado ? (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white px-6 py-4">
            <EstadoDaSessao estado={estado} />
            <p className="text-slate-700">
              <span className="font-bold text-slate-900">{fila.dado.sessao.ocupadas}</span>
              {fila.dado.sessao.vagas === null ? " inscritos" : ` de ${fila.dado.sessao.vagas} vagas ocupadas`}
              {fila.dado.reserva > 0 ? ` · ${fila.dado.reserva} na reserva` : ""}
            </p>
            <div className="flex-1" />
            {pode.abrir ? (
              <Button
                onClick={() =>
                  agir(`/v1/painel/sessoes/${sessaoId}/abrir`, {}, { titulo: "Abrir a sessão agora?", acao: "Abrir" })
                }
              >
                Abrir sessão
              </Button>
            ) : null}
            {pode.encerrar ? (
              <Button
                variant="outline"
                onClick={() =>
                  agir(
                    `/v1/painel/sessoes/${sessaoId}/encerrar`,
                    {},
                    {
                      titulo: "Encerrar a sessão?",
                      descricao: "Quem ainda está na fila vai ser remanejado ou levar falta.",
                      acao: "Encerrar",
                      perigo: true,
                    },
                  )
                }
              >
                Encerrar sessão
              </Button>
            ) : null}
          </div>
          {estado === "planejada" ? (
            <p className="text-sm text-slate-500">
              As senhas saem quando a sessão abrir. Inscritos até agora: {fila.dado.sessao.ocupadas}.
            </p>
          ) : (
            <FilaPorSituacao
              itens={fila.dado.itens}
              estacoes={hoje.dado?.estacoes ?? []}
              podePresenca={pode.presenca}
              aoMarcar={(entradaId) => presenca({ entradaId, resultado: "confere" })}
              aoRecusar={async (entradaId) => {
                // AD-039: recusar tira da fila de hoje, sem falta; sempre com motivo.
                const motivo = await perguntar({
                  titulo: "Documentos não conferem",
                  descricao: "O paciente sai da fila de hoje, sem falta.",
                  rotulo: "Motivo",
                  acao: "Não confere",
                });
                if (motivo) await presenca({ entradaId, resultado: "nao_confere", motivo });
              }}
            />
          )}
        </>
      ) : null}
    </div>
  );
}

type Item = FilaDaSessao["itens"][number];

/** Números do topo: o que a equipe olha primeiro. */
function Contadores({ itens }: { itens: Item[] }) {
  const c = contadoresDaFila(itens);
  const blocos = [
    { rotulo: "Na unidade", valor: c.naUnidade, destaque: true },
    { rotulo: "A caminho", valor: c.aCaminho },
    { rotulo: "Chamados agora", valor: c.chamados },
    { rotulo: "Atendidos", valor: c.atendidos },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {blocos.map((b) => (
        <div
          key={b.rotulo}
          className={
            b.destaque
              ? "rounded-2xl bg-primary px-5 py-4 text-white shadow-[0_3px_0_0_var(--color-primary-700)]"
              : "rounded-2xl border border-slate-200 bg-white px-5 py-4"
          }
        >
          <p className={b.destaque ? "text-sm font-semibold text-white/80" : "text-sm font-semibold text-slate-500"}>
            {b.rotulo}
          </p>
          <p className={b.destaque ? "text-4xl font-extrabold" : "text-4xl font-extrabold text-slate-900"}>{b.valor}</p>
        </div>
      ))}
    </div>
  );
}

function Grupo({
  titulo,
  descricao,
  itens,
  tom = "neutro",
  children,
}: {
  titulo: string;
  descricao: string;
  itens: Item[];
  tom?: "alerta" | "chamado" | "neutro";
  children: (i: Item) => React.ReactNode;
}) {
  if (itens.length === 0) return null;
  const borda = tom === "alerta" ? "border-amber-300" : tom === "chamado" ? "border-emerald-300" : "border-slate-200";
  return (
    <section className={`overflow-hidden rounded-2xl border bg-white ${borda}`}>
      <header className="flex items-baseline justify-between gap-4 border-b border-slate-100 px-6 py-3.5">
        <div>
          <h2 className="font-bold text-slate-900">
            {titulo} <span className="ml-1 font-semibold text-slate-400">{itens.length}</span>
          </h2>
          <p className="text-sm text-slate-500">{descricao}</p>
        </div>
      </header>
      <ul className="divide-y divide-slate-100">
        {itens.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
            {children(i)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Senha grande, nome e o que importa da pessoa naquele grupo. */
function Pessoa({ i, extra }: { i: Item; extra?: React.ReactNode }) {
  return (
    <>
      <span className="w-20 shrink-0 rounded-lg bg-slate-100 py-1 text-center font-mono text-lg font-extrabold text-slate-800">
        {i.senha}
      </span>
      <div className="flex min-w-48 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
          {i.nome}
          {i.prioridade ? (
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-600">
              prioridade
            </span>
          ) : null}
          {i.pulos > 0 ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
              {i.pulos === 1 ? "1 pulo" : `${i.pulos} pulos`}
            </span>
          ) : null}
        </span>
        <span className="text-sm text-slate-500">
          {i.etapa === "triagem" ? "Triagem" : "Atendimento"}
          {extra ? <> · {extra}</> : null}
        </span>
      </div>
    </>
  );
}

function FilaPorSituacao({
  itens,
  estacoes,
  podePresenca,
  aoMarcar,
  aoRecusar,
}: {
  itens: Item[];
  estacoes: { id: string; nome: string }[];
  podePresenca: boolean;
  aoMarcar: (entradaId: string) => void;
  aoRecusar: (entradaId: string) => void;
}) {
  const g = agruparFila(itens);
  const nomeDaEstacao = (id: string | null) => estacoes.find((e) => e.id === id)?.nome ?? "estação";
  if (itens.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">
        Ninguém na fila desta sessão ainda. Quem se inscrever pelo app aparece aqui.
      </div>
    );
  return (
    <div className="flex flex-col gap-5">
      <Contadores itens={itens} />
      <Grupo
        titulo="Esperando a recepção"
        descricao="Leram o QR e precisam conferir os documentos. Só entram na fila da unidade depois disso."
        itens={g.recepcao}
        tom="alerta"
      >
        {(i) => (
          <>
            <Pessoa
              i={i}
              extra={(textoDasPendencias(i.pendencias) ?? "conferir os documentos").replace(/^Passe na recepção: /, "")}
            />
            {podePresenca ? (
              <>
                <span className="text-sm text-slate-600">{textoDoDocumento(i.documento)}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => aoRecusar(i.entradaId)}>
                    Não confere
                  </Button>
                  <Button size="sm" onClick={() => aoMarcar(i.entradaId)}>
                    Confere, marcar presença
                  </Button>
                </div>
              </>
            ) : null}
          </>
        )}
      </Grupo>
      <Grupo titulo="Chamados agora" descricao="Indo para a sala." itens={g.chamados} tom="chamado">
        {(i) => (
          <Pessoa i={i} extra={<span className="font-semibold text-emerald-700">{nomeDaEstacao(i.estacaoId)}</span>} />
        )}
      </Grupo>
      <Grupo titulo="Na unidade" descricao="Esperando na sala de espera, pela ordem da fila." itens={g.naUnidade}>
        {(i) => <Pessoa i={i} />}
      </Grupo>
      <Grupo
        titulo="A caminho"
        descricao="Esperando em casa. Quem chegar sem o app ou sem conseguir ler o QR, a recepção marca aqui."
        itens={g.aCaminho}
      >
        {(i) => (
          <>
            <Pessoa i={i} extra={podePresenca ? textoDoDocumento(i.documento) : undefined} />
            {podePresenca ? (
              <Button size="sm" variant="secondary" onClick={() => aoMarcar(i.entradaId)}>
                Marcar presença
              </Button>
            ) : null}
          </>
        )}
      </Grupo>
      {g.encerrados.length > 0 ? (
        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-6 py-3.5 font-bold text-slate-700">
            Já saíram da fila <span className="ml-1 font-semibold text-slate-400">{g.encerrados.length}</span>
          </summary>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {g.encerrados.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-4 px-6 py-3 text-slate-500">
                <Pessoa i={i} extra={rotuloDoEstado(i.estado)} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
