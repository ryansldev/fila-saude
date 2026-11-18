import type { Action } from "@fila-saude/domain";
import type { FastifyInstance, FastifyRequest, RouteOptions } from "fastify";
import { audit } from "infra/database/municipal/schema/audit";
import type { TenantDb, TenantTx } from "infra/database/tenants";
import { ApiError } from "infra/errors";
import { allowed, type Caveats } from "./guard";
import { type ScopedProfile, userProfiles } from "./profiles";
import { staffUser } from "./session";

// PD-41: quem faz, onde e quando. Rotas e scripts passam pelo mesmo contexto.
export type ActionContext = { db: TenantDb; actor: { userId: string; profiles: ScopedProfile[] }; now: number };

export async function panelContext(req: FastifyRequest): Promise<ActionContext> {
  if (!req.tenant) await req.server.requireTenant(req);
  const user = await staffUser(req);
  if (!user || !req.tenant) throw new ApiError(401, "not_authenticated");
  return { db: req.tenant.db, actor: { userId: user.id, profiles: user.profiles }, now: Date.now() };
}

export async function userContext(db: TenantDb, userId: string, now: number): Promise<ActionContext> {
  return { db, actor: { userId, profiles: await userProfiles(db, userId) }, now };
}

export type ActionMeta<T> = {
  action: Action;
  target: { kind: string; id: string | ((r: T) => string) };
  unitId?: string | null;
  reason?: string | null;
  requiresReason?: boolean;
  caveats?: Caveats;
  data?: (r: T) => Record<string, unknown>;
};

// PD-41 / INV-12: permissão, transação e auditoria antes do commit.
export async function runAction<T>(
  ctx: ActionContext,
  meta: ActionMeta<T>,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  if (meta.requiresReason && !meta.reason?.trim()) throw new ApiError(400, "reason_required");
  if (!(await allowed(ctx.actor.profiles, meta.action, meta.unitId ?? null, meta.caveats))) {
    throw new ApiError(403, "no_permission");
  }
  return ctx.db.transaction(async (tx) => {
    const r = await fn(tx);
    await tx.insert(audit).values({
      userId: ctx.actor.userId,
      action: meta.action,
      targetKind: meta.target.kind,
      targetId: typeof meta.target.id === "function" ? meta.target.id(r) : meta.target.id,
      unitId: meta.unitId ?? null,
      reason: meta.reason ?? null,
      data: meta.data?.(r) ?? null,
      at: new Date(ctx.now),
    });
    return r;
  });
}

// PD-18: o app guarda as rotas para o teste conferir `config.acao` das mutações do painel.
const ROUTES = Symbol("rotas");
type WithRoutes = FastifyInstance & { [ROUTES]?: RouteOptions[] };

export function registerRoutes(app: FastifyInstance) {
  const list: RouteOptions[] = [];
  (app as WithRoutes)[ROUTES] = list;
  app.addHook("onRoute", (r) => {
    list.push(r);
  });
}

export function registeredRoutes(app: FastifyInstance): RouteOptions[] {
  return (app as WithRoutes)[ROUTES] ?? [];
}

const MUTATIONS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function listRoutesWithoutAction(app: FastifyInstance): string[] {
  const routes = registeredRoutes(app);
  const missing: string[] = [];
  for (const r of routes) {
    if (!r.url.startsWith("/v1/panel") || r.url.startsWith("/v1/panel/auth")) continue;
    const methods = (Array.isArray(r.method) ? r.method : [r.method]).filter((m) => MUTATIONS.has(m));
    const action = (r.config as { action?: unknown } | undefined)?.action;
    for (const m of methods) if (!action) missing.push(`${m} ${r.url}`);
  }
  return missing;
}
