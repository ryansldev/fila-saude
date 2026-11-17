import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { municipality } from "./central/schema/municipality";
import { databaseUrl } from "./database-url";
import type { Db } from "./index";

// PD-16: dois conjuntos de migrations, cada um na sua pasta; o estado fica no
// `drizzle.__drizzle_migrations` de cada banco, então migrar de novo não refaz nada.
export type MigrationsSet = "central" | "municipal";

const infraFolder = path.dirname(fileURLToPath(import.meta.url));

function setFolder(set: MigrationsSet) {
  return path.resolve(infraFolder, set, "migrations");
}

type Journal = { entries: { tag: string; when: number }[] };

// NC2: as migrations foram recriadas do zero em 2026-11-17. Um banco que tem migração aplicada fora do
// journal veio do conjunto antigo: migrar por cima colidiria com as tabelas, então para com o motivo.
async function refuseUnknownMigrations(client: Client, journal: Journal, set: MigrationsSet) {
  const table = await client.query("select to_regclass('drizzle.__drizzle_migrations') as t");
  if (!table.rows[0]?.t) return;
  const applied = await client.query<{ created_at: string }>("select created_at from drizzle.__drizzle_migrations");
  const known = new Set(journal.entries.map((e) => e.when));
  if (applied.rows.some((r) => !known.has(Number(r.created_at)))) {
    throw new Error(
      `o banco tem migrações de ${set} que não estão no journal (conjunto antigo): recrie o banco e rode npm run dev:seed`,
    );
  }
}

// `folder` só existe para o teste apontar um conjunto de migrations à parte.
export async function migrateDatabase(
  url: string,
  set: MigrationsSet,
  options: { folder?: string } = {},
): Promise<{ version: string }> {
  const migrationsFolder = options.folder ?? setFolder(set);
  const journal: Journal = JSON.parse(await readFile(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"));
  if (journal.entries.length === 0) {
    throw new Error(`nenhuma migração no journal de ${set}`);
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await refuseUnknownMigrations(client, journal, set);
    await migrate(drizzle(client), { migrationsFolder });

    // O drizzle grava o `when` do journal em `created_at`; o tag é o nome legível da migration.
    const last = await client.query<{ created_at: string }>(
      "select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
    );
    const createdAt = Number(last.rows[0]?.created_at);
    const entry = journal.entries.find((e) => e.when === createdAt);
    if (!entry) {
      throw new Error(`migração aplicada (${createdAt}) não está no journal de ${set}`);
    }

    return { version: entry.tag };
  } finally {
    await client.end();
  }
}

export type TenantResult = { slug: string; ok: boolean; version?: string; error?: string };

// PD-16 / T1.7: migra o central e depois cada município `ativo` ou `criando`, um por vez, na ordem de criação.
// Um tenant que falha fica com `migration_error` e não para os outros; a próxima execução tenta de novo e,
// dando certo, grava a versão e limpa o erro. Suspensos ficam de fora.
export async function migrateAll(deps: {
  central: Db;
  urlCentral: string;
  template: string;
}): Promise<{ central: string; tenants: TenantResult[] }> {
  const { version: versionCentral } = await migrateDatabase(deps.urlCentral, "central");

  const municipalities = await deps.central
    .select({ id: municipality.id, slug: municipality.slug, databaseRef: municipality.databaseRef })
    .from(municipality)
    .where(inArray(municipality.status, ["active", "creating"]))
    .orderBy(asc(municipality.createdAt), asc(municipality.slug));

  const tenants: TenantResult[] = [];
  for (const { id, slug, databaseRef } of municipalities) {
    try {
      const { version } = await migrateDatabase(databaseUrl(databaseRef, deps), "municipal");
      await deps.central
        .update(municipality)
        .set({ migrationVersion: version, migrationError: null })
        .where(eq(municipality.id, id));
      tenants.push({ slug, ok: true, version });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.central.update(municipality).set({ migrationError: message }).where(eq(municipality.id, id));
      tenants.push({ slug, ok: false, error: message });
    }
  }

  return { central: versionCentral, tenants };
}
