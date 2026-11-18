import { type Action, conditions } from "@fila-saude/domain";
import type { FastifyRequest } from "fastify";
import { ApiError } from "infra/errors";
import type { ScopedProfile } from "./profiles";
import { staffUser } from "./session";

// Texto da ressalva na MATRIZ → conferência feita pela rota.
export type Caveats = Partial<Record<string, () => boolean | Promise<boolean>>>;

// PD-38: contam os perfis de escopo município e, com unidade, os da mesma unidade.
export function conditionsInUnit(
  profiles: ScopedProfile[],
  action: Action,
  unitId: string | null,
): "free" | string[] | null {
  const valid = profiles.filter((p) => p.unitId === null || (unitId !== null && p.unitId === unitId));
  return conditions(
    valid.map((p) => p.profile),
    action,
  );
}

// P1 / PD-38: fechado por padrão — ressalva só passa com conferência que devolve true.
export async function allowed(
  profiles: ScopedProfile[],
  action: Action,
  unitId: string | null,
  caveats: Caveats = {},
): Promise<boolean> {
  const c = conditionsInUnit(profiles, action, unitId);
  if (c === null) return false;
  if (c === "free") return true;
  for (const r of c) {
    const verify = caveats[r];
    if (verify && (await verify())) return true;
  }
  return false;
}

type Options = {
  unit?: (req: FastifyRequest) => string | null | Promise<string | null>;
  caveats?: (req: FastifyRequest) => Caveats;
};

// preHandler das leituras do painel: resolve o tenant, exige sessão e confere a ação na unidade.
export function require(action: Action, options: Options = {}) {
  return async (req: FastifyRequest) => {
    if (!req.tenant) await req.server.requireTenant(req);
    const user = await staffUser(req);
    if (!user) throw new ApiError(401, "not_authenticated");
    const unitId = options.unit ? await options.unit(req) : null;
    if (!(await allowed(user.profiles, action, unitId, options.caveats?.(req)))) {
      throw new ApiError(403, "no_permission");
    }
  };
}

// preHandler de quem só precisa estar logado no painel do tenant.
export async function requireLogin(req: FastifyRequest) {
  if (!req.tenant) await req.server.requireTenant(req);
  if (!(await staffUser(req))) throw new ApiError(401, "not_authenticated");
}
