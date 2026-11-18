import type { FastifyInstance } from "fastify";
import { registeredRoutes } from "infra/panel/action";

// DOC2: rotas da /v1 (fora as de teste, PD-19) sem `schema` com `response`; elas não entram
// direito na referência da API.
export function listRoutesWithoutSchema(app: FastifyInstance): string[] {
  const missing: string[] = [];
  for (const r of registeredRoutes(app)) {
    if (!r.url.startsWith("/v1/") || r.url.startsWith("/v1/test/") || r.url === "/v1/test") continue;
    if (r.schema?.response) continue;
    const methods = Array.isArray(r.method) ? r.method : [r.method];
    for (const m of methods) if (m !== "HEAD") missing.push(`${m} ${r.url}`);
  }
  return missing;
}
