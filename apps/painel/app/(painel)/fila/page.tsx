"use client";

import { type FilaDeHoje, type ItemDeHoje, presencaEntradaSchema } from "@fila-saude/schemas/fila";
import { ArmchairIcon, CheckIcon, HouseIcon, MegaphoneIcon, StethoscopeIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useConfirmar, usePerguntar } from "@/components/dialogos";
import { GrupoDaFila } from "@/components/fila/grupo-da-fila";
import { LinhaDaFila } from "@/components/fila/linha-da-fila";
import { Aviso } from "@/components/formulario";
import { CabecalhoDaPagina, EstadoDaSessao } from "@/components/pagina";
import { Busca } from "@/components/ui/busca";
import { Button } from "@/components/ui/button";
import { Filtros } from "@/components/ui/filtros";
import { useApi } from "@/lib/api-context";
import { acoesDaFila, agruparFila, buscarNaFila, filaVazia, filtroValido, pilulaDaSessao } from "@/lib/fila";
import { mensagemDoErro, validarNoCliente } from "@/lib/formularios/erros";
import { useEu } from "@/lib/sessao";
import { useUnidadeAtual } from "@/lib/unidade-atual";
import { useConsulta } from "@/lib/use-consulta";

const CHAVE_DO_FILTRO = "fila-painel:filtro-da-fila";

function lerFiltro(): string | null {
  try {
    return localStorage.getItem(CHAVE_DO_FILTRO);
  } catch {
    return null;
  }
}

/**
 * Fila do dia (caminho C do design system): a unidade inteira numa fila só, para a recepção no
 * balcão — busca por nome, senha ou CPF, pílulas por serviço e, em cada linha, há quanto tempo a
 * pessoa espera. Abrir e encerrar sessão só aparece com um serviço escolhido.
 */
export default function FilaDoDia() {
  const api = useApi();
  const confirmar = useConfirmar();
  const perguntar = usePerguntar();
  const eu = useEu();
  const { atual, unidade } = useUnidadeAtual([
    "abrir_cancelar_encerrar_sessao",
    "conferir_e_marcar_presenca",
    "operar_chamadas",
  ]);
  const fuso = unidade?.fuso ?? "America/Sao_Paulo";
  const fila = useConsulta<FilaDeHoje>(atual ? `/v1/painel/unidades/${atual}/fila-de-hoje` : null, 3_000);
  const [filtro, setFiltro] = useState<string>("todas");
  const [termo, setTermo] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  const sessoes = fila.dado?.sessoes ?? [];
  // O filtro guardado só vale se a sessão ainda está entre as de hoje.
  useEffect(() => {
    if (!fila.dado) return;
    const hoje = fila.dado.sessoes;
    setFiltro((f) => (f !== "todas" && hoje.some((s) => s.id === f) ? f : filtroValido(lerFiltro(), hoje)));
  }, [fila.dado]);

  function escolherFiltro(id: string) {
    setFiltro(id);
    try {
      localStorage.setItem(CHAVE_DO_FILTRO, id);
    } catch {
      // vale só nesta página
    }
  }

  const perfis = eu.estado === "autenticado" ? eu.eu.perfis : [];
  const sessao = sessoes.find((s) => s.id === filtro) ?? null;
  const pode = (estado: string) =>
    atual ? acoesDaFila(perfis, atual, estado) : { abrir: false, encerrar: false, presenca: false };
  const podePresenca = pode("aberta").presenca;
  const agora = fila.dado ? Date.parse(fila.dado.agora) : Date.now();

  async function agir(caminho: string, corpo: unknown, pergunta?: Parameters<typeof confirmar>[0]) {
    if (pergunta && !(await confirmar(pergunta))) return;
    try {
      await api.post(caminho, corpo);
      setAviso(null);
      fila.recarregar();
    } catch (e) {
      setAviso(mensagemDoErro(e));
    }
  }

  async function presenca(i: ItemDeHoje, corpo: { resultado: "confere" | "nao_confere"; motivo?: string }) {
    const pedido = { entradaId: i.entradaId, ...corpo };
    const invalidos = validarNoCliente(presencaEntradaSchema, pedido);
    if (invalidos) return setAviso(invalidos.geral ?? Object.values(invalidos.campos)[0] ?? "Confira os dados.");
    await agir(`/v1/painel/sessoes/${i.sessaoId}/presenca`, pedido);
  }

  async function naoConfere(i: ItemDeHoje) {
    // AD-039: recusar tira da fila de hoje, sem falta; sempre com motivo.
    const motivo = await perguntar({
      titulo: "Documentos não conferem",
      descricao: "A pessoa sai da fila de hoje, sem falta.",
      rotulo: "Motivo",
      acao: "Não confere",
    });
    if (motivo) await presenca(i, { resultado: "nao_confere", motivo });
  }

  const doFiltro = (fila.dado?.itens ?? []).filter((i) => filtro === "todas" || i.sessaoId === filtro);
  const achados = buscarNaFila(doFiltro, termo);
  const g = agruparFila(achados);
  const totalNaFila = sessoes.reduce((n, s) => n + s.contagens.naFila, 0);
  const opcoes = [
    { id: "todas", rotulo: "Todas", detalhe: String(totalNaFila) },
    ...sessoes.map((s) => ({ id: s.id, icone: StethoscopeIcon, ...pilulaDaSessao(s, fuso) })),
  ];

  return (
    <div className="flex w-full flex-col gap-5">
      <CabecalhoDaPagina
        titulo="Fila do dia"
        descricao={unidade?.nome}
        acoes={
          <Busca rotulo="Buscar na fila" placeholder="Buscar nome, senha ou CPF" valor={termo} aoMudar={setTermo} />
        }
      />
      <Aviso texto={aviso ?? fila.erro} />

      {fila.dado && sessoes.length === 0 ? <p className="text-slate-600">Nenhuma sessão hoje nesta unidade.</p> : null}

      {sessoes.length > 0 ? <Filtros rotulo="Serviço" opcoes={opcoes} atual={filtro} mudar={escolherFiltro} /> : null}

      {sessao && (pode(sessao.estado).abrir || pode(sessao.estado).encerrar) ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <EstadoDaSessao estado={sessao.estado} />
          <span className="text-sm text-slate-700">
            <strong>{sessao.ocupadas}</strong>
            {sessao.vagas === null ? " inscritos" : ` de ${sessao.vagas} vagas ocupadas`}
          </span>
          {sessao.reserva > 0 ? <span className="text-sm text-slate-500">{sessao.reserva} na reserva</span> : null}
          <div className="flex-1" />
          {pode(sessao.estado).abrir ? (
            <Button
              tamanho="compacto"
              onClick={() =>
                agir(`/v1/painel/sessoes/${sessao.id}/abrir`, {}, { titulo: "Abrir a sessão agora?", acao: "Abrir" })
              }
            >
              Abrir sessão
            </Button>
          ) : null}
          {pode(sessao.estado).encerrar ? (
            <Button
              tamanho="compacto"
              variante="perigoContorno"
              onClick={() =>
                agir(
                  `/v1/painel/sessoes/${sessao.id}/encerrar`,
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
      ) : null}

      {sessoes.length > 0 && doFiltro.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-slate-500">
          {filaVazia(sessao ? [sessao] : sessoes, fuso, !sessao && pode("planejada").abrir)}
        </div>
      ) : null}
      {doFiltro.length > 0 && achados.length === 0 ? (
        <p className="text-slate-600">Ninguém com &quot;{termo.trim()}&quot; na fila de hoje.</p>
      ) : null}

      <div className="flex flex-col gap-4">
        <GrupoDaFila titulo="Esperando a recepção" icone={TriangleAlertIcon} total={g.recepcao.length} tom="alerta">
          {g.recepcao.map((i) => (
            <LinhaDaFila
              key={i.id}
              i={i}
              agora={agora}
              documento={podePresenca}
              acoes={
                podePresenca ? (
                  <>
                    <Button tamanho="compacto" variante="textoPerigo" onClick={() => naoConfere(i)}>
                      Não confere
                    </Button>
                    <Button tamanho="compacto" variante="sucesso" onClick={() => presenca(i, { resultado: "confere" })}>
                      Confere, marcar presença
                    </Button>
                  </>
                ) : null
              }
            />
          ))}
        </GrupoDaFila>
        <GrupoDaFila titulo="Chamado agora" icone={MegaphoneIcon} total={g.chamados.length} tom="chamado">
          {g.chamados.map((i) => (
            <LinhaDaFila key={i.id} i={i} agora={agora} documento={false} />
          ))}
        </GrupoDaFila>
        <GrupoDaFila titulo="Na unidade" icone={ArmchairIcon} total={g.naUnidade.length}>
          {g.naUnidade.map((i) => (
            <LinhaDaFila key={i.id} i={i} agora={agora} documento={false} />
          ))}
        </GrupoDaFila>
        <GrupoDaFila titulo="A caminho" icone={HouseIcon} total={g.aCaminho.length}>
          {g.aCaminho.map((i) => (
            <LinhaDaFila
              key={i.id}
              i={i}
              agora={agora}
              documento={podePresenca}
              acoes={
                podePresenca ? (
                  <Button
                    tamanho="compacto"
                    variante="secundario"
                    onClick={() => presenca(i, { resultado: "confere" })}
                  >
                    Marcar presença
                  </Button>
                ) : null
              }
            />
          ))}
        </GrupoDaFila>
        <GrupoDaFila titulo="Atendidos e encerrados" icone={CheckIcon} total={g.encerrados.length} recolhido>
          {g.encerrados.map((i) => (
            <LinhaDaFila key={i.id} i={i} agora={agora} documento={false} />
          ))}
        </GrupoDaFila>
      </div>
    </div>
  );
}
