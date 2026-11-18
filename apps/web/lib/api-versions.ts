import { readdirSync } from "node:fs";
import path from "node:path";

// AD-068: as versões da API são os documentos que existem (`apps/api/openapi/v{n}.json`, gerados pelo
// `npm run docs:openapi`), nunca uma lista fixa. A mais nova é a "atual".
export const OPENAPI_DIR = path.join(process.cwd(), "../api/openapi");

export const API_VERSIONS: string[] = readdirSync(OPENAPI_DIR)
  .map((name) => /^(v(\d+))\.json$/.exec(name))
  .filter((m): m is RegExpExecArray => m !== null)
  .sort((a, b) => Number(a[2]) - Number(b[2]))
  .map((m) => m[1] as string);

export const CURRENT_API_VERSION = API_VERSIONS.at(-1) ?? "v1";

export const openapiFile = (version: string) => path.join(OPENAPI_DIR, `${version}.json`);
