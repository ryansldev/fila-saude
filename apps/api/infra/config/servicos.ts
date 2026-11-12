import { contarAtivas, podeMudarExigeTriagem } from "@fila-saude/domain";
import type { Servico, ServicoEdicao, ServicoEntrada } from "@fila-saude/schemas/servico";
import { and, asc, eq, isNull } from "drizzle-orm";
import { entrada } from "infra/database/municipal/schema/entrada";
import { estacao, estacaoServico } from "infra/database/municipal/schema/estacao";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { CONFIGURAR, exigirUnidade } from "./comum";

type Linha = typeof servico.$inferSelect;

export function paraServico(s: Linha): Servico {
  return {
    id: s.id,
    unidadeId: s.unidadeId,
    nome: s.nome,
    prefixo: s.prefixo,
    exigeTriagem: s.exigeTriagem,
    modo: s.modo,
    tempoMedioMin: {
      ...(s.tempoMedioTriagemMin !== null ? { triagem: s.tempoMedioTriagemMin } : {}),
      atendimento: s.tempoMedioAtendimentoMin,
    },
    ativo: s.ativo,
  };
}

export async function exigirServico(db: BancoDoTenant, id: string): Promise<Linha> {
  const [s] = await db.select().from(servico).where(eq(servico.id, id));
  if (!s) throw new ErroApi(404, "nao_encontrado");
  return s;
}

async function prefixoLivre(db: BancoDoTenant, unidadeId: string, prefixo: string, exceto?: string) {
  const [outro] = await db
    .select({ id: servico.id })
    .from(servico)
    .where(and(eq(servico.unidadeId, unidadeId), eq(servico.prefixo, prefixo)));
  if (outro && outro.id !== exceto) throw new ErroApi(409, "prefixo_em_uso");
}

// T2.3: serviço da unidade com prefixo, triagem, modo e tempos médios.
export async function criarServico(ctx: ContextoDaAcao, unidadeId: string, dados: ServicoEntrada): Promise<Servico> {
  await exigirUnidade(ctx.db, unidadeId);
  return executarAcao(ctx, { acao: CONFIGURAR, alvo: { tipo: "servico", id: (s) => s.id }, unidadeId }, async (tx) => {
    await prefixoLivre(tx, unidadeId, dados.prefixo);
    const [s] = await tx
      .insert(servico)
      .values({
        unidadeId,
        nome: dados.nome,
        prefixo: dados.prefixo,
        exigeTriagem: dados.exigeTriagem,
        modo: dados.modo,
        tempoMedioTriagemMin: dados.tempoMedioMin.triagem ?? null,
        ...(dados.tempoMedioMin.atendimento ? { tempoMedioAtendimentoMin: dados.tempoMedioMin.atendimento } : {}),
      })
      .returning();
    return paraServico(s as Linha);
  });
}

export async function editarServico(ctx: ContextoDaAcao, servicoId: string, dados: ServicoEdicao): Promise<Servico> {
  const atual = await exigirServico(ctx.db, servicoId);
  return executarAcao(
    ctx,
    { acao: CONFIGURAR, alvo: { tipo: "servico", id: servicoId }, unidadeId: atual.unidadeId },
    async (tx) => {
      if (dados.prefixo && dados.prefixo !== atual.prefixo)
        await prefixoLivre(tx, atual.unidadeId, dados.prefixo, servicoId);

      if (dados.exigeTriagem !== undefined && dados.exigeTriagem !== atual.exigeTriagem) {
        const sessoes = await tx.select({ estado: sessao.estado }).from(sessao).where(eq(sessao.servicoId, servicoId));
        if (!podeMudarExigeTriagem(sessoes))
          throw new ErroApi(409, "sessao_aberta", undefined, "Há sessão aberta deste serviço.");
        if (!dados.exigeTriagem) {
          const [triagem] = await tx
            .select({ id: estacao.id })
            .from(estacaoServico)
            .innerJoin(estacao, eq(estacaoServico.estacaoId, estacao.id))
            .where(
              and(eq(estacaoServico.servicoId, servicoId), eq(estacao.etapa, "triagem"), isNull(estacao.arquivadaEm)),
            );
          if (triagem) throw new ErroApi(409, "servico_em_estacao_de_triagem");
        }
      }

      // PD-42: na v0.1 o modo só muda sem entradas ativas.
      if (dados.modo && dados.modo !== atual.modo) {
        const entradas = await tx
          .select({ estado: entrada.estado })
          .from(entrada)
          .where(eq(entrada.servicoId, servicoId));
        const ativas = contarAtivas(entradas);
        if (ativas > 0)
          throw new ErroApi(409, "servico_com_entradas", undefined, undefined, { entradasAtivas: ativas });
        if (dados.modo === "regulado") {
          const [publica] = await tx
            .select({ id: sessao.id })
            .from(sessao)
            .where(
              and(eq(sessao.servicoId, servicoId), eq(sessao.visibilidade, "publica"), eq(sessao.estado, "planejada")),
            );
          if (publica) throw new ErroApi(409, "servico_regulado");
        }
      }

      const [s] = await tx
        .update(servico)
        .set({
          ...(dados.nome !== undefined ? { nome: dados.nome } : {}),
          ...(dados.prefixo !== undefined ? { prefixo: dados.prefixo } : {}),
          ...(dados.exigeTriagem !== undefined ? { exigeTriagem: dados.exigeTriagem } : {}),
          ...(dados.modo !== undefined ? { modo: dados.modo } : {}),
          ...(dados.tempoMedioMin
            ? {
                tempoMedioTriagemMin: dados.tempoMedioMin.triagem ?? null,
                ...(dados.tempoMedioMin.atendimento
                  ? { tempoMedioAtendimentoMin: dados.tempoMedioMin.atendimento }
                  : {}),
              }
            : {}),
        })
        .where(eq(servico.id, servicoId))
        .returning();
      return paraServico(s as Linha);
    },
  );
}

export async function listarServicos(ctx: ContextoDaAcao, unidadeId: string): Promise<Servico[]> {
  const linhas = await ctx.db
    .select()
    .from(servico)
    .where(eq(servico.unidadeId, unidadeId))
    .orderBy(asc(servico.criadoEm));
  return linhas.map(paraServico);
}
