import type { Estacao, EstacaoEdicao, EstacaoEntrada } from "@fila-saude/schemas/estacao";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { estacao, estacaoServico } from "infra/database/municipal/schema/estacao";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao, sessaoEstacao } from "infra/database/municipal/schema/sessao";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { CONFIGURAR, exigirUnidade } from "./comum";

type Linha = typeof estacao.$inferSelect;

async function paraEstacao(db: BancoDoTenant, e: Linha): Promise<Estacao> {
  const servicos = await db
    .select({ id: estacaoServico.servicoId })
    .from(estacaoServico)
    .where(eq(estacaoServico.estacaoId, e.id));
  return {
    id: e.id,
    unidadeId: e.unidadeId,
    nome: e.nome,
    etapa: e.etapa,
    servicos: servicos.map((s) => s.id),
    aberta: e.aberta,
  };
}

// RN-EST-01 / RN-TRI-02: serviços da mesma unidade; estação de triagem só com serviços que exigem triagem.
async function validarServicos(db: BancoDoTenant, unidadeId: string, etapa: Linha["etapa"], ids: string[]) {
  const achados = await db.select().from(servico).where(inArray(servico.id, ids));
  if (achados.length !== new Set(ids).size || achados.some((s) => s.unidadeId !== unidadeId)) {
    throw new ErroApi(400, "entrada_invalida", { servicos: ["só serviços desta unidade"] });
  }
  if (etapa === "triagem" && achados.some((s) => !s.exigeTriagem)) {
    throw new ErroApi(400, "entrada_invalida", {
      servicos: ["estação de triagem só atende serviços que exigem triagem"],
    });
  }
}

export async function exigirEstacao(db: BancoDoTenant, id: string): Promise<Linha> {
  const [e] = await db
    .select()
    .from(estacao)
    .where(and(eq(estacao.id, id), isNull(estacao.arquivadaEm)));
  if (!e) throw new ErroApi(404, "nao_encontrado");
  return e;
}

export async function criarEstacao(ctx: ContextoDaAcao, unidadeId: string, dados: EstacaoEntrada): Promise<Estacao> {
  await exigirUnidade(ctx.db, unidadeId);
  return executarAcao(ctx, { acao: CONFIGURAR, alvo: { tipo: "estacao", id: (e) => e.id }, unidadeId }, async (tx) => {
    await validarServicos(tx, unidadeId, dados.etapa, dados.servicos);
    const [e] = await tx.insert(estacao).values({ unidadeId, nome: dados.nome, etapa: dados.etapa }).returning();
    const linha = e as Linha;
    await tx.insert(estacaoServico).values(dados.servicos.map((servicoId) => ({ estacaoId: linha.id, servicoId })));
    return paraEstacao(tx, linha);
  });
}

export async function editarEstacao(ctx: ContextoDaAcao, id: string, dados: EstacaoEdicao): Promise<Estacao> {
  const atual = await exigirEstacao(ctx.db, id);
  return executarAcao(
    ctx,
    { acao: CONFIGURAR, alvo: { tipo: "estacao", id }, unidadeId: atual.unidadeId },
    async (tx) => {
      let linha = atual;
      if (dados.nome !== undefined) {
        const [e] = await tx.update(estacao).set({ nome: dados.nome }).where(eq(estacao.id, id)).returning();
        linha = e as Linha;
      }
      if (dados.servicos) {
        await validarServicos(tx, atual.unidadeId, atual.etapa, dados.servicos);
        await tx.delete(estacaoServico).where(eq(estacaoServico.estacaoId, id));
        await tx.insert(estacaoServico).values(dados.servicos.map((servicoId) => ({ estacaoId: id, servicoId })));
      }
      return paraEstacao(tx, linha);
    },
  );
}

export async function arquivarEstacao(ctx: ContextoDaAcao, id: string): Promise<void> {
  const atual = await exigirEstacao(ctx.db, id);
  await executarAcao(
    ctx,
    { acao: CONFIGURAR, alvo: { tipo: "estacao", id }, unidadeId: atual.unidadeId },
    async (tx) => {
      if (atual.aberta) throw new ErroApi(409, "estacao_ocupada", undefined, "A estação está aberta.");
      // Sessão planejada ou aberta que usa a estação ficaria sem quem chama (ou sem poder encerrar).
      const [emUso] = await tx
        .select({ id: sessao.id })
        .from(sessaoEstacao)
        .innerJoin(sessao, eq(sessaoEstacao.sessaoId, sessao.id))
        .where(and(eq(sessaoEstacao.estacaoId, id), inArray(sessao.estado, ["planejada", "aberta"])))
        .limit(1);
      if (emUso)
        throw new ErroApi(
          409,
          "estacao_em_uso",
          undefined,
          "A estação está em uma sessão planejada ou aberta. Tire-a dessas sessões antes de remover.",
        );
      await tx
        .update(estacao)
        .set({ arquivadaEm: new Date(ctx.agora) })
        .where(eq(estacao.id, id));
    },
  );
}

export async function listarEstacoes(ctx: ContextoDaAcao, unidadeId: string): Promise<Estacao[]> {
  const linhas = await ctx.db
    .select()
    .from(estacao)
    .where(and(eq(estacao.unidadeId, unidadeId), isNull(estacao.arquivadaEm)))
    .orderBy(asc(estacao.criadoEm));
  return Promise.all(linhas.map((e) => paraEstacao(ctx.db, e)));
}
