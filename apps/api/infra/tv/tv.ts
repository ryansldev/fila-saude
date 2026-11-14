import { createHash, randomBytes, randomInt } from "node:crypto";
import type { TvDaUnidade, TvEstado, TvRegistro } from "@fila-saude/schemas/tv";
import { and, eq, gt, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { CONFIGURAR, exigirUnidade } from "infra/config/comum";
import { diaSessao } from "infra/database/municipal/schema/dia-sessao";
import { estacao } from "infra/database/municipal/schema/estacao";
import { servico } from "infra/database/municipal/schema/servico";
import { sessao } from "infra/database/municipal/schema/sessao";
import { tv } from "infra/database/municipal/schema/tv";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { BancoDoTenant, DbDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { configDaUnidade } from "infra/fila/dia";
import { conteudoDoQr } from "infra/fila/qr";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";

const VALIDADE_DO_CODIGO_MS = 15 * 60_000;
const ONLINE_MS = 60_000;
const SINAL_MS = 20_000;
const ULTIMAS = 5;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

// PD-47 / RN-TV-01: a TV se registra sozinha; o código só vale enquanto ninguém o usou e não venceu.
// Dois códigos pendentes iguais deixariam o admin parear a TV errada: sorteia de novo.
export async function registrarTv(db: DbDoTenant, agora: number): Promise<TvRegistro> {
  const token = randomBytes(32).toString("base64url");
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const [igual] = await db
      .select({ id: tv.id })
      .from(tv)
      .where(and(eq(tv.codigo, codigo), ...pendente(agora)))
      .limit(1);
    if (igual) continue;
    await db.insert(tv).values({ codigo, tokenHash: hash(token), criadaEm: new Date(agora) });
    return { codigo, token };
  }
  throw new ErroApi(503, "tente_de_novo");
}

const pendente = (agora: number) => [
  isNull(tv.unidadeId),
  isNull(tv.revogadaEm),
  gt(tv.criadaEm, new Date(agora - VALIDADE_DO_CODIGO_MS)),
];

async function tvDoToken(db: BancoDoTenant, token: string | null) {
  if (!token) throw new ErroApi(401, "tv_nao_pareada");
  const [linha] = await db
    .select()
    .from(tv)
    .where(eq(tv.tokenHash, hash(token)));
  if (!linha || linha.revogadaEm) throw new ErroApi(401, "tv_nao_pareada");
  return linha;
}

export async function parearTv(ctx: ContextoDaAcao, unidadeId: string, codigo: string): Promise<{ id: string }> {
  await exigirUnidade(ctx.db, unidadeId);
  return executarAcao(ctx, { acao: CONFIGURAR, alvo: { tipo: "tv", id: (r) => r.id }, unidadeId }, async (tx) => {
    const [linha] = await tx
      .update(tv)
      .set({ unidadeId, pareadaEm: new Date(ctx.agora) })
      .where(and(eq(tv.codigo, codigo), ...pendente(ctx.agora)))
      .returning({ id: tv.id });
    if (!linha) throw new ErroApi(404, "codigo_invalido", undefined, "Código não encontrado ou vencido.");
    return linha;
  });
}

export async function tvsDaUnidade(ctx: ContextoDaAcao, unidadeId: string): Promise<TvDaUnidade[]> {
  const linhas = await ctx.db
    .select()
    .from(tv)
    .where(and(eq(tv.unidadeId, unidadeId), isNull(tv.revogadaEm), isNotNull(tv.pareadaEm)));
  return linhas.map((t) => ({
    id: t.id,
    pareadaEm: (t.pareadaEm as Date).toISOString(),
    ultimoSinalEm: t.ultimoSinalEm?.toISOString() ?? null,
    online: t.ultimoSinalEm !== null && ctx.agora - t.ultimoSinalEm.getTime() < ONLINE_MS,
  }));
}

export async function revogarTv(ctx: ContextoDaAcao, tvId: string): Promise<{ id: string }> {
  const [t] = await ctx.db.select().from(tv).where(eq(tv.id, tvId));
  if (!t?.unidadeId || t.revogadaEm) throw new ErroApi(404, "nao_encontrado");
  return executarAcao(ctx, { acao: CONFIGURAR, alvo: { tipo: "tv", id: tvId }, unidadeId: t.unidadeId }, async (tx) => {
    await tx
      .update(tv)
      .set({ revogadaEm: new Date(ctx.agora) })
      .where(eq(tv.id, tvId));
    return { id: tvId };
  });
}

// RN-TV-02..07: só a unidade pareada; só senhas, destino e números.
export async function telaDaTv(db: DbDoTenant, slug: string, token: string | null, agora: number): Promise<TvEstado> {
  const t = await tvDoToken(db, token);
  // RN-TV-06: sinal de vida, gravado no máximo a cada 20 s.
  await db
    .update(tv)
    .set({ ultimoSinalEm: new Date(agora) })
    .where(and(eq(tv.id, t.id), or(isNull(tv.ultimoSinalEm), lt(tv.ultimoSinalEm, new Date(agora - SINAL_MS)))));
  if (!t.unidadeId) {
    // O servidor decide a validade (o relógio da TV pode estar errado): vencido, a TV se registra de novo.
    if (t.criadaEm.getTime() + VALIDADE_DO_CODIGO_MS <= agora) throw new ErroApi(401, "tv_nao_pareada");
    return {
      estado: "aguardando",
      codigo: t.codigo,
      expiraEm: new Date(t.criadaEm.getTime() + VALIDADE_DO_CODIGO_MS).toISOString(),
    };
  }
  const [u] = await db.select().from(unidade).where(eq(unidade.id, t.unidadeId));
  if (!u || u.arquivadaEm) throw new ErroApi(401, "tv_nao_pareada");

  const abertas = await db
    .select({ servico: servico.nome, dia: diaSessao.dia })
    .from(sessao)
    .innerJoin(servico, eq(sessao.servicoId, servico.id))
    .innerJoin(diaSessao, eq(diaSessao.sessaoId, sessao.id))
    .where(and(eq(servico.unidadeId, u.id), eq(sessao.estado, "aberta")));
  const idsDeEstacao = [...new Set(abertas.flatMap(({ dia }) => dia.chamadas.map((c) => c.estacaoId)))];
  const nomes = new Map(
    idsDeEstacao.length === 0
      ? []
      : (
          await db.select({ id: estacao.id, nome: estacao.nome }).from(estacao).where(inArray(estacao.id, idsDeEstacao))
        ).map((e) => [e.id, e.nome]),
  );

  const chamadas = abertas
    .flatMap(({ dia }) =>
      // RN-CHAM-02: cada rechamada é um anúncio novo.
      dia.chamadas.flatMap((c) =>
        [c.em, ...(c.rechamadas ?? [])].map((em) => ({
          id: `${c.itemId}:${em}`,
          senha: dia.itens.find((i) => i.id === c.itemId)?.senha ?? "",
          destino: nomes.get(c.estacaoId) ?? "",
          em,
        })),
      ),
    )
    .sort((a, b) => b.em - a.em)
    .slice(0, ULTIMAS)
    .map((c) => ({ ...c, em: new Date(c.em).toISOString() }));

  const porServico = new Map<string, { aguardando: number; aCaminho: number }>();
  for (const { servico: nome, dia } of abertas) {
    const atual = porServico.get(nome) ?? { aguardando: 0, aCaminho: 0 };
    atual.aguardando += dia.itens.filter((i) => i.estado === "presente").length;
    atual.aCaminho += dia.itens.filter((i) => i.estado === "remoto").length;
    porServico.set(nome, atual);
  }

  const qr = await conteudoDoQr(db, slug, u.id, agora);
  return {
    estado: "pareada",
    unidade: { id: u.id, nome: u.nome },
    destaqueSegundos: configDaUnidade(u).destaqueTvSegundos,
    chamadas,
    servicos: [...porServico].map(([nome, n]) => ({ nome, ...n })).sort((a, b) => a.nome.localeCompare(b.nome)),
    qr: qr.conteudo && qr.expiraEm ? { conteudo: qr.conteudo, expiraEm: qr.expiraEm } : null,
    atendimentoIniciado: abertas.some(({ dia }) => dia.estacoes.some((e) => e.aberta)),
  };
}
