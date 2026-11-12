import type {
  PerfilComEscopo as PerfilEntrada,
  UsuarioPainel,
  UsuarioPainelEntrada,
} from "@fila-saude/schemas/usuario";
import { and, asc, eq, inArray } from "drizzle-orm";
import { criarUsuarioPainel } from "infra/auth/painel";
import { usuarioPainel } from "infra/database/municipal/schema/auth";
import { perfilUsuario } from "infra/database/municipal/schema/perfil";
import { unidade } from "infra/database/municipal/schema/unidade";
import type { BancoDoTenant } from "infra/database/tenants";
import { ErroApi } from "infra/erros";
import { type ContextoDaAcao, executarAcao } from "infra/painel/acao";
import { concederPerfis, type PerfilComEscopo, perfisDoUsuario } from "infra/painel/perfis";
import { GESTAO } from "./comum";

// RN-PERF-01: gestor só no município; os outros perfis numa unidade existente do tenant.
async function validarPerfis(db: BancoDoTenant, perfis: PerfilEntrada[]): Promise<PerfilComEscopo[]> {
  const campos: Record<string, string[]> = {};
  perfis.forEach((p, i) => {
    if (p.perfil === "gestor" && p.unidadeId !== null)
      campos[`perfis.${i}.unidadeId`] = ["gestor é do município, sem unidade"];
    if (p.perfil !== "gestor" && p.unidadeId === null) campos[`perfis.${i}.unidadeId`] = ["escolha a unidade"];
  });
  const ids = [...new Set(perfis.map((p) => p.unidadeId).filter((x): x is string => x !== null))];
  if (ids.length > 0) {
    const achadas = new Set(
      (await db.select({ id: unidade.id }).from(unidade).where(inArray(unidade.id, ids))).map((u) => u.id),
    );
    perfis.forEach((p, i) => {
      if (p.unidadeId && !achadas.has(p.unidadeId)) campos[`perfis.${i}.unidadeId`] = ["unidade não encontrada"];
    });
  }
  if (Object.keys(campos).length > 0) throw new ErroApi(400, "entrada_invalida", campos);
  return perfis as PerfilComEscopo[];
}

async function usuarioComPerfis(db: BancoDoTenant, id: string): Promise<UsuarioPainel> {
  const [u] = await db.select().from(usuarioPainel).where(eq(usuarioPainel.id, id));
  if (!u) throw new ErroApi(404, "nao_encontrado");
  return { id: u.id, login: u.username ?? "", nome: u.name, perfis: await perfisDoUsuario(db, id) };
}

export async function criarUsuario(ctx: ContextoDaAcao, dados: UsuarioPainelEntrada): Promise<UsuarioPainel> {
  const perfis = await validarPerfis(ctx.db, dados.perfis);
  return executarAcao(
    ctx,
    { acao: GESTAO, alvo: { tipo: "usuario", id: (u) => u.id }, dados: (u) => ({ perfis: u.perfis }) },
    async (tx) => {
      const { id } = await criarUsuarioPainel(tx, { login: dados.login, nome: dados.nome, senha: dados.senha });
      await concederPerfis(tx, id, perfis, ctx.ator.usuarioId);
      return usuarioComPerfis(tx, id);
    },
  );
}

export async function listarUsuarios(ctx: ContextoDaAcao): Promise<UsuarioPainel[]> {
  const usuarios = await ctx.db.select().from(usuarioPainel).orderBy(asc(usuarioPainel.createdAt));
  return Promise.all(usuarios.map((u) => usuarioComPerfis(ctx.db, u.id)));
}

export async function trocarPerfis(
  ctx: ContextoDaAcao,
  usuarioId: string,
  novos: PerfilEntrada[],
): Promise<UsuarioPainel> {
  await usuarioComPerfis(ctx.db, usuarioId);
  const perfis = await validarPerfis(ctx.db, novos);
  return executarAcao(
    ctx,
    { acao: GESTAO, alvo: { tipo: "usuario", id: usuarioId }, dados: (u) => ({ perfis: u.perfis }) },
    async (tx) => {
      const atuais = await perfisDoUsuario(tx, usuarioId);
      const eraGestor = atuais.some((p) => p.perfil === "gestor");
      if (eraGestor && !perfis.some((p) => p.perfil === "gestor")) {
        const gestores = await tx
          .selectDistinct({ id: perfilUsuario.usuarioId })
          .from(perfilUsuario)
          .where(eq(perfilUsuario.perfil, "gestor"));
        if (gestores.length <= 1) throw new ErroApi(409, "ultimo_gestor");
      }
      await tx.delete(perfilUsuario).where(and(eq(perfilUsuario.usuarioId, usuarioId)));
      await concederPerfis(tx, usuarioId, perfis, ctx.ator.usuarioId);
      return usuarioComPerfis(tx, usuarioId);
    },
  );
}
