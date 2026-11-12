import { type Acao, condicoes } from "@fila-saude/domain";
import type { FastifyRequest } from "fastify";
import { ErroApi } from "infra/erros";
import type { PerfilComEscopo } from "./perfis";
import { usuarioDoPainel } from "./sessao";

// Texto da ressalva na MATRIZ → conferência feita pela rota.
export type Ressalvas = Partial<Record<string, () => boolean | Promise<boolean>>>;

// PD-38: contam os perfis de escopo município e, com unidade, os da mesma unidade.
export function condicoesNaUnidade(
  perfis: PerfilComEscopo[],
  acao: Acao,
  unidadeId: string | null,
): "livre" | string[] | null {
  const validos = perfis.filter((p) => p.unidadeId === null || (unidadeId !== null && p.unidadeId === unidadeId));
  return condicoes(
    validos.map((p) => p.perfil),
    acao,
  );
}

// P1 / PD-38: fechado por padrão — ressalva só passa com conferência que devolve true.
export async function permitido(
  perfis: PerfilComEscopo[],
  acao: Acao,
  unidadeId: string | null,
  ressalvas: Ressalvas = {},
): Promise<boolean> {
  const c = condicoesNaUnidade(perfis, acao, unidadeId);
  if (c === null) return false;
  if (c === "livre") return true;
  for (const r of c) {
    const conferir = ressalvas[r];
    if (conferir && (await conferir())) return true;
  }
  return false;
}

type Opcoes = {
  unidade?: (req: FastifyRequest) => string | null | Promise<string | null>;
  ressalvas?: (req: FastifyRequest) => Ressalvas;
};

// preHandler das leituras do painel: resolve o tenant, exige sessão e confere a ação na unidade.
export function exigir(acao: Acao, opcoes: Opcoes = {}) {
  return async (req: FastifyRequest) => {
    if (!req.tenant) await req.server.exigirTenant(req);
    const usuario = await usuarioDoPainel(req);
    if (!usuario) throw new ErroApi(401, "nao_autenticado");
    const unidadeId = opcoes.unidade ? await opcoes.unidade(req) : null;
    if (!(await permitido(usuario.perfis, acao, unidadeId, opcoes.ressalvas?.(req)))) {
      throw new ErroApi(403, "sem_permissao");
    }
  };
}

// preHandler de quem só precisa estar logado no painel do tenant.
export async function exigirLogin(req: FastifyRequest) {
  if (!req.tenant) await req.server.exigirTenant(req);
  if (!(await usuarioDoPainel(req))) throw new ErroApi(401, "nao_autenticado");
}
