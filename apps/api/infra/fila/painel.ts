import {
  abrirSessao,
  conferirEMarcar,
  type DiaSessao,
  desfechoDaEntrada,
  encerrar,
  mesmoDia,
  origemDaSessao,
  temPrioridade,
} from "@fila-saude/domain";
import type { FilaDaSessao, HojeNaUnidade } from "@fila-saude/schemas/fila";
import { and, asc, eq, gt, inArray, isNull, lt } from "drizzle-orm";
import { exigirUnidade, SESSAO } from "infra/config/comum";
import { exigirSessao, paraSessao } from "infra/config/sessoes";
import { entrada } from "infra/database/municipal/schema/entrada";
import { estacao } from "infra/database/municipal/schema/estacao";
import { pessoaLocal } from "infra/database/municipal/schema/pessoa-local";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
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
  daEquipeDaUnidade(ctx, servico.unidadeId);
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

// RN-FILA-05: a recepção confere e marca a presença na mesma ação (o QR do check-in vem na fatia 2).
export async function marcarPresencaNaFila(
  ctx: ContextoDaAcao,
  sessaoId: string,
  dados: {
    entradaId: string;
    resultado: "confere" | "nao_confere" | "prioridade_nao_confere";
    motivo?: string | undefined;
  },
): Promise<FilaDaSessao> {
  const { servico } = await exigirSessao(ctx.db, sessaoId);
  return executarAcao(
    ctx,
    {
      acao: "conferir_e_marcar_presenca",
      alvo: { tipo: "entrada", id: dados.entradaId },
      unidadeId: servico.unidadeId,
      motivo: dados.motivo ?? null,
      dados: () => ({ resultado: dados.resultado }),
    },
    async (tx) => {
      const dia = await naSessao(tx, sessaoId, async (c) => {
        const item = c.dia?.itens.find((i) => i.entradaId === dados.entradaId);
        if (!c.dia || !item) throw new ErroApi(404, "nao_encontrado");
        const cmd = { itemId: item.id, resultado: dados.resultado, ...(dados.motivo ? { motivo: dados.motivo } : {}) };
        const r = conferirEMarcar(c.dia, cmd, ctx.agora);
        if (!r.ok) throw new ErroApi(409, r.erro);
        const entradas = c.entradas.map((en) => {
          const it = r.estado.itens.find((i) => i.entradaId === en.id);
          if (!it || en.estado !== "na_fila") return en;
          const d = desfechoDaEntrada(en, it);
          return d.ok ? d.estado : en;
        });
        return { dia: r.estado, entradas, resultado: r.estado };
      });
      return paraFila(tx, sessaoId, dia);
    },
  );
}

function daEquipeDaUnidade(ctx: ContextoDaAcao, unidadeId: string) {
  if (!ctx.ator.perfis.some((p) => p.unidadeId === null || p.unidadeId === unidadeId)) {
    throw new ErroApi(403, "sem_permissao");
  }
}

// F1: sessões de hoje (dia local da unidade) e estações, para quem tem papel na unidade.
export async function hojeNaUnidade(ctx: ContextoDaAcao, unidadeId: string): Promise<HojeNaUnidade> {
  const u = await exigirUnidade(ctx.db, unidadeId);
  daEquipeDaUnidade(ctx, unidadeId);
  const linhas = await ctx.db
    .select({ s: sessao, servico: servico.nome })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .where(
      and(
        eq(servico.unidadeId, unidadeId),
        gt(sessao.fim, new Date(ctx.agora - 36 * 3600_000)),
        lt(sessao.inicio, new Date(ctx.agora + 36 * 3600_000)),
      ),
    )
    .orderBy(asc(sessao.inicio));
  const sessoes = [];
  for (const { s, servico: nome } of linhas) {
    if (s.estado === "cancelada" || !mesmoDia(s.inicio.getTime(), ctx.agora, u.fuso)) continue;
    sessoes.push({ ...(await paraSessao(ctx.db, s)), servico: nome });
  }
  const estacoes = await ctx.db
    .select({ id: estacao.id, nome: estacao.nome, etapa: estacao.etapa })
    .from(estacao)
    .where(and(eq(estacao.unidadeId, unidadeId), isNull(estacao.arquivadaEm)))
    .orderBy(asc(estacao.criadoEm));
  return { sessoes, estacoes };
}
