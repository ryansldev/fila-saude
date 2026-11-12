import type { Acao } from "@fila-saude/domain";
import type { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { auditoria } from "infra/database/municipal/schema/auditoria";
import type { DbDoTenant, TxDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { permitido, type Ressalvas } from "./guard";
import { type PerfilComEscopo, perfisDoUsuario } from "./perfis";
import { usuarioDoPainel } from "./sessao";

// PD-41: quem faz, onde e quando. Rotas e scripts passam pelo mesmo contexto.
export type ContextoDaAcao = { db: DbDoTenant; ator: { usuarioId: string; perfis: PerfilComEscopo[] }; agora: number };

export async function contextoDoPainel(req: FastifyRequest): Promise<ContextoDaAcao> {
  if (!req.tenant) await req.server.exigirTenant(req);
  const usuario = await usuarioDoPainel(req);
  if (!usuario || !req.tenant) throw new ErroApi(401, "nao_autenticado");
  return { db: req.tenant.db, ator: { usuarioId: usuario.id, perfis: usuario.perfis }, agora: Date.now() };
}

export async function contextoDoUsuario(db: DbDoTenant, usuarioId: string, agora: number): Promise<ContextoDaAcao> {
  return { db, ator: { usuarioId, perfis: await perfisDoUsuario(db, usuarioId) }, agora };
}

export type MetaDaAcao<T> = {
  acao: Acao;
  alvo: { tipo: string; id: string | ((r: T) => string) };
  unidadeId?: string | null;
  motivo?: string | null;
  exigeMotivo?: boolean;
  ressalvas?: Ressalvas;
  dados?: (r: T) => Record<string, unknown>;
};

// PD-41 / INV-12: permissão, transação e auditoria antes do commit.
export async function executarAcao<T>(
  ctx: ContextoDaAcao,
  meta: MetaDaAcao<T>,
  fn: (tx: TxDoTenant) => Promise<T>,
): Promise<T> {
  if (meta.exigeMotivo && !meta.motivo?.trim()) throw new ErroApi(400, "motivo_obrigatorio");
  if (!(await permitido(ctx.ator.perfis, meta.acao, meta.unidadeId ?? null, meta.ressalvas))) {
    throw new ErroApi(403, "sem_permissao");
  }
  return ctx.db.transaction(async (tx) => {
    const r = await fn(tx);
    await tx.insert(auditoria).values({
      usuarioId: ctx.ator.usuarioId,
      acao: meta.acao,
      alvoTipo: meta.alvo.tipo,
      alvoId: typeof meta.alvo.id === "function" ? meta.alvo.id(r) : meta.alvo.id,
      unidadeId: meta.unidadeId ?? null,
      motivo: meta.motivo ?? null,
      dados: meta.dados?.(r) ?? null,
      em: new Date(ctx.agora),
    });
    return r;
  });
}

// PD-18: o app guarda as rotas para o teste conferir `config.acao` das mutações do painel.
const ROTAS = Symbol("rotas");
type ComRotas = FastifyInstance & { [ROTAS]?: RouteOptions[] };

export function registrarRotas(app: FastifyInstance) {
  const lista: RouteOptions[] = [];
  (app as ComRotas)[ROTAS] = lista;
  app.addHook("onRoute", (r) => {
    lista.push(r);
  });
}

const MUTACOES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function listarRotasSemAcao(app: FastifyInstance): string[] {
  const rotas = (app as ComRotas)[ROTAS] ?? [];
  const faltando: string[] = [];
  for (const r of rotas) {
    if (!r.url.startsWith("/v1/painel") || r.url.startsWith("/v1/painel/auth")) continue;
    const metodos = (Array.isArray(r.method) ? r.method : [r.method]).filter((m) => MUTACOES.has(m));
    const acao = (r.config as { acao?: unknown } | undefined)?.acao;
    for (const m of metodos) if (!acao) faltando.push(`${m} ${r.url}`);
  }
  return faltando;
}
