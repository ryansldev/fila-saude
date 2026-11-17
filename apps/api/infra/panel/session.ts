import { type Assignments, rolesOf } from "@fila-saude/domain";
import type { FastifyRequest } from "fastify";
import { tenantAuth } from "infra/auth/panel";
import { type ScopedProfile, userAssignments } from "./profiles";

export type StaffUser = Assignments & { id: string; name: string; login: string; profiles: ScopedProfile[] };

function headers(req: FastifyRequest): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) h.append(k, item);
  }
  return h;
}

const memo = new WeakMap<FastifyRequest, Promise<StaffUser | null>>();

async function fetch(req: FastifyRequest): Promise<StaffUser | null> {
  const tenant = req.tenant;
  if (!tenant) return null;
  const session = await tenantAuth(tenant.slug, tenant.db).api.getSession({ headers: headers(req) });
  if (!session) return null;
  const u = session.user as { id: string; name: string; username?: string | null; displayUsername?: string | null };
  const assignments = await userAssignments(tenant.db, u.id);
  return {
    id: u.id,
    name: u.name,
    login: u.username ?? "",
    ...assignments,
    profiles: rolesOf(assignments) as ScopedProfile[],
  };
}

// T1.9: quem está logado no painel do tenant da requisição (memoizado por requisição).
export function staffUser(req: FastifyRequest): Promise<StaffUser | null> {
  let p = memo.get(req);
  if (!p) {
    p = fetch(req);
    memo.set(req, p);
  }
  return p;
}
