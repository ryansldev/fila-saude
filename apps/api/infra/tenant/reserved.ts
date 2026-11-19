import { inArray } from "drizzle-orm";
import type database from "infra/database";
import { municipality } from "infra/database/central/schema/municipality";
import { RESERVED_SLUGS } from "./slug";

// AD-069 / DA12: municípios do catálogo com nome reservado (criados antes da regra). O Host deles não
// resolve mais, então a API recusa subir enquanto existir algum (`server.ts`).
export async function reservedMunicipalities(db: typeof database): Promise<string[]> {
  const rows = await db
    .select({ slug: municipality.slug })
    .from(municipality)
    .where(inArray(municipality.slug, [...RESERVED_SLUGS]));
  return rows.map((r) => r.slug).sort();
}
