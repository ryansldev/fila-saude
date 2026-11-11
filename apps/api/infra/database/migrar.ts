import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

// PD-16: dois conjuntos de migrations, cada um na sua pasta; o estado fica no
// `drizzle.__drizzle_migrations` de cada banco, então migrar de novo não refaz nada.
export type ConjuntoDeMigrations = "central" | "municipal";

const pastaDaInfra = path.dirname(fileURLToPath(import.meta.url));

function pastaDoConjunto(conjunto: ConjuntoDeMigrations) {
  return path.resolve(pastaDaInfra, conjunto, "migrations");
}

type Journal = { entries: { tag: string; when: number }[] };

export async function migrarBanco(url: string, conjunto: ConjuntoDeMigrations): Promise<{ versao: string }> {
  const migrationsFolder = pastaDoConjunto(conjunto);
  const cliente = new Client({ connectionString: url });
  await cliente.connect();

  try {
    await migrate(drizzle(cliente), { migrationsFolder });

    // O drizzle grava o `when` do journal em `created_at`; o tag é o nome legível da migration.
    const ultima = await cliente.query<{ created_at: string }>(
      "select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
    );
    const criadaEm = Number(ultima.rows[0]?.created_at);
    const journal: Journal = JSON.parse(await readFile(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"));
    const entrada = journal.entries.find((e) => e.when === criadaEm);
    if (!entrada) {
      throw new Error(`migração aplicada (${criadaEm}) não está no journal de ${conjunto}`);
    }

    return { versao: entrada.tag };
  } finally {
    await cliente.end();
  }
}
