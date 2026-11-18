import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "app";
import { openApiDocument } from "infra/openapi/document";

// DOC2: grava a referência da v1 (`openapi/v1.json`) a partir das rotas, no formato do Biome. Não abre
// conexão com o banco. O teste `openapi.test.ts` falha se o arquivo no git ficar para trás.
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../openapi/v1.json");

const app = await buildApp({ logger: false, background: false, openapi: true });
await writeFile(file, JSON.stringify(await openApiDocument(app)));
await app.close();
execFileSync("npx", ["biome", "format", "--write", file], { stdio: "ignore" });
console.log(`gravado ${path.relative(process.cwd(), file)}`);
