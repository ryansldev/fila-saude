import { eq, sql } from "drizzle-orm";
import type { Db } from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import { escapeIdentifier } from "pg";
import { databaseForSlug } from "./slug";

// Apaga o banco do município (derrubando conexões abertas) e a linha do catálogo. Só para dev e testes.
export async function dropTenant(slug: string, deps: { central: Db }): Promise<void> {
  await deps.central.execute(
    sql.raw(`drop database if exists ${escapeIdentifier(databaseForSlug(slug))} with (force)`),
  );
  await deps.central.delete(municipality).where(eq(municipality.slug, slug));
}
