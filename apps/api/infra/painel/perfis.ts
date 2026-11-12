import type { Perfil } from "@fila-saude/domain";
import { asc, eq } from "drizzle-orm";
import { perfilUsuario } from "infra/database/municipal/schema/perfil";
import type { BancoDoTenant } from "infra/database/tenants";

export type PerfilDoPainel = Exclude<Perfil, "paciente">;
export type PerfilComEscopo = { perfil: PerfilDoPainel; unidadeId: string | null };

// RN-PERF-01: perfis acumuláveis, cada um com o seu escopo.
export async function concederPerfis(
  db: BancoDoTenant,
  usuarioId: string,
  perfis: PerfilComEscopo[],
  concedidoPor: string | null,
): Promise<void> {
  if (perfis.length === 0) return;
  await db
    .insert(perfilUsuario)
    .values(perfis.map((p) => ({ usuarioId, perfil: p.perfil, unidadeId: p.unidadeId, concedidoPor })))
    .onConflictDoNothing();
}

export async function perfisDoUsuario(db: BancoDoTenant, usuarioId: string): Promise<PerfilComEscopo[]> {
  return db
    .select({ perfil: perfilUsuario.perfil, unidadeId: perfilUsuario.unidadeId })
    .from(perfilUsuario)
    .where(eq(perfilUsuario.usuarioId, usuarioId))
    .orderBy(asc(perfilUsuario.concedidoEm), asc(perfilUsuario.perfil));
}
