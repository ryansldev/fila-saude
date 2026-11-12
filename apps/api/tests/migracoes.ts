import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// A última migration municipal do journal: os testes não fixam um número que muda a cada migration.
const journal = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../infra/database/municipal/migrations/meta/_journal.json",
    ),
    "utf8",
  ),
) as { entries: { tag: string }[] };

export const MIGRATIONS_MUNICIPAIS = journal.entries.length;
export const ULTIMA_MUNICIPAL = journal.entries.at(-1)?.tag as string;
