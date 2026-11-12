import { type Atribuicoes, type Perfil, papeisDe } from "@fila-saude/domain";
import { asc, eq } from "drizzle-orm";
import { funcaoUsuario, vinculo } from "infra/database/municipal/schema/equipe";
import type { BancoDoTenant } from "infra/database/tenants";

export type PerfilDoPainel = Exclude<Perfil, "paciente">;
/** Papel de permissão com escopo (o que o guard confere), derivado das atribuições. */
export type PerfilComEscopo = { perfil: PerfilDoPainel; unidadeId: string | null };

// Ocupações e funções gravadas da pessoa (RN-PERF-04).
export async function atribuicoesDoUsuario(db: BancoDoTenant, usuarioId: string): Promise<Atribuicoes> {
  const vinculos = await db
    .select({ unidadeId: vinculo.unidadeId, ocupacao: vinculo.ocupacao })
    .from(vinculo)
    .where(eq(vinculo.usuarioId, usuarioId))
    .orderBy(asc(vinculo.concedidoEm), asc(vinculo.ocupacao));
  const funcoes = await db
    .select({ funcao: funcaoUsuario.funcao, unidadeId: funcaoUsuario.unidadeId })
    .from(funcaoUsuario)
    .where(eq(funcaoUsuario.usuarioId, usuarioId))
    .orderBy(asc(funcaoUsuario.concedidoEm), asc(funcaoUsuario.funcao));
  return { vinculos, funcoes };
}

// Acrescenta atribuições (as repetidas são ignoradas).
export async function concederAtribuicoes(
  db: BancoDoTenant,
  usuarioId: string,
  a: Atribuicoes,
  concedidoPor: string | null,
): Promise<void> {
  if (a.vinculos.length > 0) {
    await db
      .insert(vinculo)
      .values(a.vinculos.map((v) => ({ usuarioId, unidadeId: v.unidadeId, ocupacao: v.ocupacao, concedidoPor })))
      .onConflictDoNothing();
  }
  if (a.funcoes.length > 0) {
    await db
      .insert(funcaoUsuario)
      .values(a.funcoes.map((f) => ({ usuarioId, funcao: f.funcao, unidadeId: f.unidadeId, concedidoPor })))
      .onConflictDoNothing();
  }
}

export async function substituirAtribuicoes(
  db: BancoDoTenant,
  usuarioId: string,
  a: Atribuicoes,
  concedidoPor: string | null,
): Promise<void> {
  await db.delete(vinculo).where(eq(vinculo.usuarioId, usuarioId));
  await db.delete(funcaoUsuario).where(eq(funcaoUsuario.usuarioId, usuarioId));
  await concederAtribuicoes(db, usuarioId, a, concedidoPor);
}

export async function perfisDoUsuario(db: BancoDoTenant, usuarioId: string): Promise<PerfilComEscopo[]> {
  return papeisDe(await atribuicoesDoUsuario(db, usuarioId)) as PerfilComEscopo[];
}
