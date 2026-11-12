import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { municipio } from "./central/schema/municipio";
import type { Db } from "./index";
import { urlDoBanco } from "./url-do-banco";

// PD-16: dois conjuntos de migrations, cada um na sua pasta; o estado fica no
// `drizzle.__drizzle_migrations` de cada banco, então migrar de novo não refaz nada.
export type ConjuntoDeMigrations = "central" | "municipal";

const pastaDaInfra = path.dirname(fileURLToPath(import.meta.url));

function pastaDoConjunto(conjunto: ConjuntoDeMigrations) {
  return path.resolve(pastaDaInfra, conjunto, "migrations");
}

type Journal = { entries: { tag: string; when: number }[] };

// `pasta` só existe para o teste apontar um conjunto de migrations à parte.
export async function migrarBanco(
  url: string,
  conjunto: ConjuntoDeMigrations,
  opcoes: { pasta?: string } = {},
): Promise<{ versao: string }> {
  const migrationsFolder = opcoes.pasta ?? pastaDoConjunto(conjunto);
  const journal: Journal = JSON.parse(await readFile(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"));
  if (journal.entries.length === 0) {
    throw new Error(`nenhuma migração no journal de ${conjunto}`);
  }

  const cliente = new Client({ connectionString: url });
  await cliente.connect();

  try {
    await migrate(drizzle(cliente), { migrationsFolder });

    // O drizzle grava o `when` do journal em `created_at`; o tag é o nome legível da migration.
    const ultima = await cliente.query<{ created_at: string }>(
      "select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1",
    );
    const criadaEm = Number(ultima.rows[0]?.created_at);
    const entrada = journal.entries.find((e) => e.when === criadaEm);
    if (!entrada) {
      throw new Error(`migração aplicada (${criadaEm}) não está no journal de ${conjunto}`);
    }

    return { versao: entrada.tag };
  } finally {
    await cliente.end();
  }
}

export type ResultadoDoTenant = { slug: string; ok: boolean; versao?: string; erro?: string };

// PD-16 / T1.7: migra o central e depois cada município `ativo` ou `criando`, um por vez, na ordem de criação.
// Um tenant que falha fica com `migracao_erro` e não para os outros; a próxima execução tenta de novo e,
// dando certo, grava a versão e limpa o erro. Suspensos ficam de fora.
export async function migrarTodos(deps: {
  central: Db;
  urlCentral: string;
  template: string;
}): Promise<{ central: string; tenants: ResultadoDoTenant[] }> {
  const { versao: versaoCentral } = await migrarBanco(deps.urlCentral, "central");

  const municipios = await deps.central
    .select({ id: municipio.id, slug: municipio.slug, bancoRef: municipio.bancoRef })
    .from(municipio)
    .where(inArray(municipio.status, ["ativo", "criando"]))
    .orderBy(asc(municipio.criadoEm), asc(municipio.slug));

  const tenants: ResultadoDoTenant[] = [];
  for (const { id, slug, bancoRef } of municipios) {
    try {
      const { versao } = await migrarBanco(urlDoBanco(bancoRef, deps), "municipal");
      await deps.central
        .update(municipio)
        .set({ migracaoVersao: versao, migracaoErro: null })
        .where(eq(municipio.id, id));
      tenants.push({ slug, ok: true, versao });
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      await deps.central.update(municipio).set({ migracaoErro: mensagem }).where(eq(municipio.id, id));
      tenants.push({ slug, ok: false, erro: mensagem });
    }
  }

  return { central: versaoCentral, tenants };
}
