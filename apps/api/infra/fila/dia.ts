import {
  CONFIG_PADRAO,
  type ConfigUnidade,
  configEfetiva,
  type DiaSessao,
  type Entrada,
  type Servico,
  type SessaoVagas,
} from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import { PgTransaction } from "drizzle-orm/pg-core";
import { diaSessao } from "infra/database/municipal/schema/dia-sessao";
import { estacao, estacaoServico } from "infra/database/municipal/schema/estacao";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao, sessaoEstacao } from "infra/database/municipal/schema/sessao";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { BancoDoTenant, DbDoTenant, TxDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { atualizarEntrada, entradasDaSessao } from "./entradas";

type LinhaSessao = typeof sessao.$inferSelect;
type LinhaServico = typeof servico.$inferSelect;
type LinhaUnidade = typeof unidade.$inferSelect;

export const paraSessaoVagas = (s: LinhaSessao): SessaoVagas => ({
  id: s.id,
  servicoId: s.servicoId,
  visibilidade: s.visibilidade,
  vagas: s.vagas,
  inicio: s.inicio.getTime(),
  ocupadas: s.ocupadas,
});

export const paraServico = (s: LinhaServico): Servico => ({ id: s.id, modo: s.modo, exigeTriagem: s.exigeTriagem });

export const configDaUnidade = (u: LinhaUnidade): ConfigUnidade => ({
  ...CONFIG_PADRAO,
  ...configEfetiva({ municipio: {}, unidade: u.config }),
  fuso: u.fuso,
});

async function linhas(db: BancoDoTenant, sessaoId: string, travar: boolean) {
  const q = db
    .select({ s: sessao, srv: servico, u: unidade })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .innerJoin(unidade, eq(servico.unidadeId, unidade.id))
    .where(eq(sessao.id, sessaoId));
  const [linha] = travar ? await q.for("update", { of: sessao }) : await q;
  if (!linha) throw new ErroApi(404, "nao_encontrado");
  return linha;
}

export async function lerDia(db: BancoDoTenant, sessaoId: string): Promise<DiaSessao | null> {
  const [linha] = await db.select().from(diaSessao).where(eq(diaSessao.sessaoId, sessaoId));
  return linha?.dia ?? null;
}

// PD-44: o dia de uma sessão planejada é montado na hora: serviço, estações da sessão e config da unidade.
// Na v0.1 as estações da sessão começam abertas (a tela da estação não tem "abrir/fechar" ainda).
export async function montarDia(db: BancoDoTenant, sessaoId: string): Promise<DiaSessao> {
  const { s, srv, u } = await linhas(db, sessaoId, false);
  const ests = await db
    .select({ e: estacao })
    .from(sessaoEstacao)
    .innerJoin(estacao, eq(sessaoEstacao.estacaoId, estacao.id))
    .where(eq(sessaoEstacao.sessaoId, sessaoId));
  const servicosDe = async (estacaoId: string) =>
    (
      await db
        .select({ id: estacaoServico.servicoId })
        .from(estacaoServico)
        .where(eq(estacaoServico.estacaoId, estacaoId))
    ).map((x) => x.id);
  const estacoes = await Promise.all(
    ests
      .filter(({ e }) => e.arquivadaEm === null)
      .map(async ({ e }) => ({
        id: e.id,
        etapa: e.etapa,
        servicos: await servicosDe(e.id),
        aberta: true,
        chamadoItemId: null,
      })),
  );
  const tempoInicialMin: DiaSessao["tempoInicialMin"] = { atendimento: srv.tempoMedioAtendimentoMin };
  if (srv.tempoMedioTriagemMin !== null) tempoInicialMin.triagem = srv.tempoMedioTriagemMin;
  return {
    sessaoId: s.id,
    servicoId: srv.id,
    estado: "planejada",
    itens: [],
    chamadas: [],
    avisosSaiaDeCasa: [],
    tempoInicialMin,
    estacoes,
    config: configDaUnidade(u),
    contingencias: [],
    proximoNumero: 1,
    prefixoSenha: srv.prefixo,
    exigeTriagem: srv.exigeTriagem,
  };
}

export type ContextoDaSessao = {
  tx: TxDoTenant;
  linha: LinhaSessao;
  servicoLinha: LinhaServico;
  unidadeLinha: LinhaUnidade;
  sessao: SessaoVagas;
  servico: Servico;
  /** `null` enquanto planejada (PD-44). */
  dia: DiaSessao | null;
  /** Entradas que apontam para esta sessão. */
  entradas: Entrada[];
};

export type Mudancas<T> = { dia?: DiaSessao | null; sessao?: SessaoVagas; entradas?: Entrada[]; resultado: T };

// PD-43 / INV-04: trava a sessão, roda `fn` e grava dia, entradas mudadas e vagas na mesma transação.
export async function naSessao<T>(
  db: DbDoTenant | TxDoTenant,
  sessaoId: string,
  fn: (c: ContextoDaSessao) => Promise<Mudancas<T>>,
): Promise<T> {
  const corpo = async (tx: TxDoTenant) => {
    const { s, srv, u } = await linhas(tx, sessaoId, true);
    const dia = await lerDia(tx, sessaoId);
    const entradas = await entradasDaSessao(tx, sessaoId);
    const m = await fn({
      tx,
      linha: s,
      servicoLinha: srv,
      unidadeLinha: u,
      sessao: paraSessaoVagas(s),
      servico: paraServico(srv),
      dia,
      entradas,
    });
    const antes = new Map(entradas.map((e) => [e.id, JSON.stringify(e)]));
    for (const e of m.entradas ?? []) {
      if (antes.get(e.id) !== JSON.stringify(e)) await atualizarEntrada(tx, e);
    }
    const mudancas: Partial<typeof sessao.$inferInsert> = {};
    if (m.sessao && m.sessao.ocupadas !== s.ocupadas) mudancas.ocupadas = m.sessao.ocupadas;
    if (m.dia && m.dia.estado !== "planejada") {
      await tx
        .insert(diaSessao)
        .values({ sessaoId, dia: m.dia })
        .onConflictDoUpdate({ target: diaSessao.sessaoId, set: { dia: m.dia, atualizadoEm: new Date() } });
      if (m.dia.estado !== s.estado) mudancas.estado = m.dia.estado;
    }
    if (Object.keys(mudancas).length > 0) {
      await tx
        .update(sessao)
        .set({ ...mudancas, versao: s.versao + 1 })
        .where(eq(sessao.id, sessaoId));
    }
    return m.resultado;
  };
  if (db instanceof PgTransaction) return corpo(db as TxDoTenant);
  return (db as DbDoTenant).transaction(corpo);
}
