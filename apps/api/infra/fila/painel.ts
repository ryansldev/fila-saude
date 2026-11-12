import { abrirSessao, type DiaSessao, encerrar, origemDaSessao, temPrioridade } from "@fila-saude/domain";
import type { FilaDaSessao } from "@fila-saude/schemas/fila";
import { eq, inArray } from "drizzle-orm";
import { SESSAO } from "infra/config/comum";
import { exigirSessao, paraSessao } from "infra/config/sessoes";
import { entrada } from "infra/database/municipal/schema/entrada";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { lerDia, montarDia, naSessao } from "./dia";

export async function nomesDasEntradas(db: BancoDoTenant, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const linhas = await db
    .select({ id: entrada.id, nome: pessoaLocal.nome })
    .from(entrada)
    .innerJoin(pessoaLocal, eq(entrada.pessoaLocalId, pessoaLocal.id))
    .where(inArray(entrada.id, ids));
  return new Map(linhas.map((l) => [l.id, l.nome]));
}

async function paraFila(db: BancoDoTenant, sessaoId: string, dia: DiaSessao | null): Promise<FilaDaSessao> {
  const { s } = await exigirSessao(db, sessaoId);
  const itens = dia?.itens ?? [];
  const nomes = await nomesDasEntradas(
    db,
    itens.map((i) => i.entradaId),
  );
  const naReserva = (
    await db.select({ estado: entrada.estado }).from(entrada).where(eq(entrada.sessaoId, sessaoId))
  ).filter((e) => e.estado === "na_reserva").length;
  return {
    sessao: await paraSessao(db, s),
    itens: itens.map((i) => ({
      id: i.id,
      senha: i.senha,
      nome: nomes.get(i.entradaId) ?? "",
      etapa: i.etapa,
      estado: i.estado,
      pulos: i.pulos,
      risco: i.risco,
      prioridade: temPrioridade(i.prioridade),
      estacaoId: dia?.estacoes.find((e) => e.chamadoItemId === i.id)?.id ?? null,
    })),
    reserva: naReserva,
  };
}

// Qualquer pessoa da equipe com papel na unidade (ou no município) vê a fila do dia (decisão F1).
export async function filaDaSessao(ctx: ContextoDaAcao, sessaoId: string): Promise<FilaDaSessao> {
  const { servico } = await exigirSessao(ctx.db, sessaoId);
  if (!ctx.ator.perfis.some((p) => p.unidadeId === null || p.unidadeId === servico.unidadeId)) {
    throw new ErroApi(403, "sem_permissao");
  }
  return paraFila(ctx.db, sessaoId, await lerDia(ctx.db, sessaoId));
}

// T3.4 / PD-33: abertura por botão; o worker chama a mesma função depois.
export async function abrirSessaoDoDia(ctx: ContextoDaAcao, sessaoId: string): Promise<FilaDaSessao> {
  const { servico } = await exigirSessao(ctx.db, sessaoId);
  return executarAcao(
    ctx,
    {
      acao: SESSAO,
      alvo: { tipo: "sessao", id: sessaoId },
      unidadeId: servico.unidadeId,
      dados: () => ({ evento: "abrir" }),
    },
    async (tx) => {
      const dia = await naSessao(tx, sessaoId, async (c) => {
        if (c.linha.estado !== "planejada") throw new ErroApi(409, "transicao_proibida");
        const r = abrirSessao(
          c.dia ?? (await montarDia(tx, sessaoId)),
          c.sessao,
          c.entradas,
          { servico: c.servico, fotosAceitas: [] },
          ctx.agora,
        );
        if (!r.ok) throw new ErroApi(409, r.erro);
        return { dia: r.estado.dia, sessao: r.estado.sessao, entradas: r.estado.entradas, resultado: r.estado.dia };
      });
      return paraFila(tx, sessaoId, dia);
    },
  );
}

// T3.9 / RN-SES-01..03: encerrar só sem estação com chamado; remanejados e faltas pelo domínio.
export async function encerrarSessaoDoDia(ctx: ContextoDaAcao, sessaoId: string): Promise<FilaDaSessao> {
  const { servico } = await exigirSessao(ctx.db, sessaoId);
  return executarAcao(
    ctx,
    {
      acao: SESSAO,
      alvo: { tipo: "sessao", id: sessaoId },
      unidadeId: servico.unidadeId,
      dados: () => ({ evento: "encerrar" }),
    },
    async (tx) => {
      const dia = await naSessao(tx, sessaoId, async (c) => {
        if (!c.dia || c.dia.estado !== "aberta") throw new ErroApi(409, "transicao_proibida");
        const r = encerrar(c.dia, c.entradas, ctx.agora, {
          semSinalSemContingencia: false,
          origem: origemDaSessao(c.sessao, c.servico),
        });
        if (!r.ok) throw new ErroApi(409, r.erro);
        return { dia: r.estado.dia, entradas: r.estado.entradas, resultado: r.estado.dia };
      });
      return paraFila(tx, sessaoId, dia);
    },
  );
}
