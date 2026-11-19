import { execFileSync } from "node:child_process";
import { readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "app";
import { openApiDocuments } from "infra/openapi/document";

// AD-066 / AD-068: grava a referência de cada versão (`openapi/v{n}.json`) a partir das rotas, no formato
// do Biome, e apaga a de versão que não existe mais. Não abre conexão com o banco. O teste
// `openapi.test.ts` falha se os arquivos no git ficarem para trás.
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../openapi");

const app = await buildApp({ logger: false, background: false, openapi: true });
const docs = await openApiDocuments(app);
await app.close();

// Sem nenhuma versão é erro de montagem do app: para antes de apagar ou formatar qualquer arquivo.
if (Object.keys(docs).length === 0) throw new Error("nenhuma rota versionada (/v{n}/…) para documentar");

const written = Object.keys(docs).map((version) => path.join(dir, `${version}.json`));
for (const [version, doc] of Object.entries(docs))
  await writeFile(path.join(dir, `${version}.json`), JSON.stringify(doc));
for (const name of await readdir(dir)) {
  if (/^v[1-9]\d*\.json$/.test(name) && !written.includes(path.join(dir, name))) await rm(path.join(dir, name));
}
execFileSync("npx", ["biome", "format", "--write", ...written], { stdio: "ignore" });
console.log(`gravado ${written.map((f) => path.relative(process.cwd(), f)).join(", ")}`);
