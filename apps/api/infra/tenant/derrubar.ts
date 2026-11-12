import { eq, sql } from "drizzle-orm";
import type { Db } from "infra/database";
import { municipio } from "infra/database/central/schema/municipio";
import { escapeIdentifier } from "pg";
import { bancoDoSlug } from "./slug";

// Apaga o banco do município (derrubando conexões abertas) e a linha do catálogo. Só para dev e testes.
export async function derrubarTenant(slug: string, deps: { central: Db }): Promise<void> {
  await deps.central.execute(sql.raw(`drop database if exists ${escapeIdentifier(bancoDoSlug(slug))} with (force)`));
  await deps.central.delete(municipio).where(eq(municipio.slug, slug));
}
