import { type Atribuicoes, papeisDe } from "@fila-saude/domain";
import type { FastifyRequest } from "fastify";
import { authDoTenant } from "infra/auth/painel";
import { atribuicoesDoUsuario, type PerfilComEscopo } from "./perfis";

export type UsuarioDoPainel = Atribuicoes & { id: string; nome: string; login: string; perfis: PerfilComEscopo[] };

function cabecalhos(req: FastifyRequest): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) h.append(k, item);
  }
  return h;
}

const memo = new WeakMap<FastifyRequest, Promise<UsuarioDoPainel | null>>();

async function buscar(req: FastifyRequest): Promise<UsuarioDoPainel | null> {
  const tenant = req.tenant;
  if (!tenant) return null;
  const sessao = await authDoTenant(tenant.slug, tenant.db).api.getSession({ headers: cabecalhos(req) });
  if (!sessao) return null;
  const u = sessao.user as { id: string; name: string; username?: string | null; displayUsername?: string | null };
  const atribuicoes = await atribuicoesDoUsuario(tenant.db, u.id);
  return {
    id: u.id,
    nome: u.name,
    login: u.username ?? "",
    ...atribuicoes,
    perfis: papeisDe(atribuicoes) as PerfilComEscopo[],
  };
}

// T1.9: quem está logado no painel do tenant da requisição (memoizado por requisição).
export function usuarioDoPainel(req: FastifyRequest): Promise<UsuarioDoPainel | null> {
  let p = memo.get(req);
  if (!p) {
    p = buscar(req);
    memo.set(req, p);
  }
  return p;
}
