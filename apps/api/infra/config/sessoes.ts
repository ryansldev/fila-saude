import { type ConfigSessao, type ModoServico, mudarVisibilidade, validarSessao } from "@fila-saude/domain";
import type { Sessao, SessaoEdicao, SessaoEntrada, VisibilidadeEntrada } from "@fila-saude/schemas/sessao";
import { and, asc, eq, gte, inArray, isNull, lt, notInArray } from "drizzle-orm";
import { entrada } from "infra/database/municipal/schema/entrada";
import { estacao, estacaoServico } from "infra/database/municipal/schema/estacao";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao, sessaoEstacao } from "infra/database/municipal/schema/sessao";
import type { BancoDoTenant } from "infra/database/tenants";
import { camposDoDominio, ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { CONFIGURAR, exigirUnidade, SESSAO } from "./comum";
import { exigirServico } from "./servicos";

type Linha = typeof sessao.$inferSelect;

export async function paraSessao(db: BancoDoTenant, s: Linha): Promise<Sessao> {
  const estacoes = await db
    .select({ id: sessaoEstacao.estacaoId })
    .from(sessaoEstacao)
    .where(eq(sessaoEstacao.sessaoId, s.id));
  return {
    id: s.id,
    servicoId: s.servicoId,
    inicio: s.inicio.toISOString(),
    fim: s.fim.toISOString(),
    vagas: s.vagas,
    ocupadas: s.ocupadas,
    visibilidade: s.visibilidade,
    dispensaPreCadastro: s.dispensaPreCadastro,
    profissional: s.profissional,
    estacoes: estacoes.map((e) => e.id),
    estado: s.estado,
    versao: s.versao,
  };
}

async function estacoesDoServico(db: BancoDoTenant, servicoId: string): Promise<string[]> {
  const linhas = await db
    .select({ id: estacao.id })
    .from(estacaoServico)
    .innerJoin(estacao, eq(estacaoServico.estacaoId, estacao.id))
    .where(and(eq(estacaoServico.servicoId, servicoId), isNull(estacao.arquivadaEm)));
  return linhas.map((l) => l.id);
}

// RN-ENC-05 / AD-016: a configuração valida pelo domínio; erros de campo → 400, regulado público → 409.
async function conferir(db: BancoDoTenant, s: { id: string; modo: ModoServico }, c: ConfigSessao) {
  const v = validarSessao({ modo: s.modo, estacoesDoServico: await estacoesDoServico(db, s.id) }, c);
  if (v.ok) return;
  if (v.erro === "servico_regulado") throw new ErroApi(409, "servico_regulado");
  throw new ErroApi(400, "entrada_invalida", camposDoDominio(v.campos ?? {}));
}

async function trocarEstacoes(db: BancoDoTenant, sessaoId: string, estacoes: string[]) {
  await db.delete(sessaoEstacao).where(eq(sessaoEstacao.sessaoId, sessaoId));
  if (estacoes.length > 0)
    await db.insert(sessaoEstacao).values(estacoes.map((estacaoId) => ({ sessaoId, estacaoId })));
}

export async function exigirSessao(db: BancoDoTenant, id: string) {
  const [linha] = await db
    .select({ s: sessao, servico })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .where(eq(sessao.id, id));
  if (!linha) throw new ErroApi(404, "nao_encontrado");
  return linha;
}

// T2.5: sessão avulsa do serviço da unidade.
export async function criarSessao(ctx: ContextoDaAcao, unidadeId: string, dados: SessaoEntrada): Promise<Sessao> {
  await exigirUnidade(ctx.db, unidadeId);
  const s = await exigirServico(ctx.db, dados.servicoId).catch(() => null);
  if (!s || s.unidadeId !== unidadeId)
    throw new ErroApi(400, "entrada_invalida", { servicoId: ["serviço desta unidade"] });
  return executarAcao(ctx, { acao: CONFIGURAR, alvo: { tipo: "sessao", id: (x) => x.id }, unidadeId }, async (tx) => {
    await conferir(tx, s, dados);
    const [linha] = await tx
      .insert(sessao)
      .values({
        servicoId: s.id,
        inicio: new Date(dados.inicio),
        fim: new Date(dados.fim),
        vagas: dados.vagas,
        visibilidade: dados.visibilidade,
        dispensaPreCadastro: dados.dispensaPreCadastro,
        profissional: dados.profissional,
      })
      .returning();
    const nova = linha as Linha;
    await trocarEstacoes(tx, nova.id, dados.estacoes);
    return paraSessao(tx, nova);
  });
}

function travar(atual: Linha, versao: number) {
  if (atual.versao !== versao) throw new ErroApi(409, "versao_desatualizada", undefined, "A sessão mudou. Recarregue.");
}

async function gravar(tx: BancoDoTenant, atual: Linha, mudancas: Partial<typeof sessao.$inferInsert>): Promise<Linha> {
  const [linha] = await tx
    .update(sessao)
    .set({ ...mudancas, versao: atual.versao + 1 })
    .where(and(eq(sessao.id, atual.id), eq(sessao.versao, atual.versao)))
    .returning();
  if (!linha) throw new ErroApi(409, "versao_desatualizada", undefined, "A sessão mudou. Recarregue.");
  return linha;
}

export async function editarSessao(ctx: ContextoDaAcao, id: string, dados: SessaoEdicao): Promise<Sessao> {
  const { s: atual, servico: srv } = await exigirSessao(ctx.db, id);
  return executarAcao(ctx, { acao: CONFIGURAR, alvo: { tipo: "sessao", id }, unidadeId: srv.unidadeId }, async (tx) => {
    travar(atual, dados.versao);
    const inicio = dados.inicio ? new Date(dados.inicio) : atual.inicio;
    const fim = dados.fim ? new Date(dados.fim) : atual.fim;
    const mudouHorario = inicio.getTime() !== atual.inicio.getTime() || fim.getTime() !== atual.fim.getTime();
    if (mudouHorario && atual.estado !== "planejada") throw new ErroApi(409, "transicao_proibida");
    if (fim <= inicio) throw new ErroApi(400, "entrada_invalida", { fim: ["fim deve ser depois do início"] });
    const vagas = dados.vagas !== undefined ? dados.vagas : atual.vagas;
    if (vagas !== null && vagas < atual.ocupadas) {
      throw new ErroApi(409, "vagas_abaixo_das_ocupadas", undefined, undefined, { ocupadas: atual.ocupadas });
    }
    const estacoes =
      dados.estacoes ??
      (await tx.select({ id: sessaoEstacao.estacaoId }).from(sessaoEstacao).where(eq(sessaoEstacao.sessaoId, id))).map(
        (e) => e.id,
      );
    await conferir(tx, srv, {
      vagas,
      visibilidade: atual.visibilidade,
      dispensaPreCadastro: atual.dispensaPreCadastro,
      profissional: dados.profissional !== undefined ? dados.profissional : atual.profissional,
      estacoes,
    });
    const linha = await gravar(tx, atual, {
      inicio,
      fim,
      vagas,
      ...(dados.profissional !== undefined ? { profissional: dados.profissional } : {}),
    });
    if (dados.estacoes) await trocarEstacoes(tx, id, dados.estacoes);
    return paraSessao(tx, linha);
  });
}

// RN-PUB-03: privada perde a dispensa; pública não vale em serviço regulado.
export async function mudarVisibilidadeDaSessao(
  ctx: ContextoDaAcao,
  id: string,
  dados: VisibilidadeEntrada,
): Promise<Sessao> {
  const { s: atual, servico: srv } = await exigirSessao(ctx.db, id);
  return executarAcao(ctx, { acao: SESSAO, alvo: { tipo: "sessao", id }, unidadeId: srv.unidadeId }, async (tx) => {
    travar(atual, dados.versao);
    const config: ConfigSessao = {
      vagas: atual.vagas,
      visibilidade: atual.visibilidade,
      dispensaPreCadastro: atual.dispensaPreCadastro,
      profissional: atual.profissional,
      estacoes: [],
    };
    const r = mudarVisibilidade(config, dados.visibilidade, srv.modo);
    if (!r.ok) throw new ErroApi(409, r.erro);
    let dispensa = r.estado.dispensaPreCadastro;
    if (dados.dispensaPreCadastro !== undefined) {
      if (dados.dispensaPreCadastro && r.estado.visibilidade !== "publica") {
        throw new ErroApi(400, "entrada_invalida", { dispensaPreCadastro: ["a dispensa só vale em sessão pública"] });
      }
      dispensa = dados.dispensaPreCadastro;
    }
    const linha = await gravar(tx, atual, { visibilidade: r.estado.visibilidade, dispensaPreCadastro: dispensa });
    return paraSessao(tx, linha);
  });
}

const FINAIS = ["cancelada", "concluida", "encerrada_sem_atendimento", "arquivada"] as const;

// Só planejada e sem pacientes na v0.1 (o remanejamento vem depois).
export async function cancelarSessao(ctx: ContextoDaAcao, id: string): Promise<Sessao> {
  const { s: atual, servico: srv } = await exigirSessao(ctx.db, id);
  return executarAcao(ctx, { acao: SESSAO, alvo: { tipo: "sessao", id }, unidadeId: srv.unidadeId }, async (tx) => {
    if (atual.estado !== "planejada") throw new ErroApi(409, "transicao_proibida");
    const [com] = await tx
      .select({ id: entrada.id })
      .from(entrada)
      .where(and(eq(entrada.sessaoId, id), notInArray(entrada.estado, [...FINAIS])));
    if (com) throw new ErroApi(409, "sessao_com_pacientes", undefined, "Há pacientes nesta sessão.");
    const linha = await gravar(tx, atual, { estado: "cancelada" });
    return paraSessao(tx, linha);
  });
}

export async function listarSessoes(
  ctx: ContextoDaAcao,
  unidadeId: string,
  intervalo: { de: Date; ate: Date },
): Promise<Sessao[]> {
  const servicos = (await ctx.db.select({ id: servico.id }).from(servico).where(eq(servico.unidadeId, unidadeId))).map(
    (s) => s.id,
  );
  if (servicos.length === 0) return [];
  const linhas = await ctx.db
    .select()
    .from(sessao)
    .where(and(inArray(sessao.servicoId, servicos), gte(sessao.inicio, intervalo.de), lt(sessao.inicio, intervalo.ate)))
    .orderBy(asc(sessao.inicio));
  return Promise.all(linhas.map((s) => paraSessao(ctx.db, s)));
}
