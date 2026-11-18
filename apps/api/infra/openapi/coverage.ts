import type { FastifyInstance } from "fastify";
import { isOutsideReference } from "infra/openapi/document";
import { registeredRoutes } from "infra/panel/action";

// DOC2: rotas da referência da API (ver `isOutsideReference`) sem `schema` com `response`.
export function listRoutesWithoutSchema(app: FastifyInstance): string[] {
  const missing: string[] = [];
  for (const r of registeredRoutes(app)) {
    if (isOutsideReference(r.url) || r.url === "/v1/test") continue;
    if (r.schema?.response) continue;
    const methods = Array.isArray(r.method) ? r.method : [r.method];
    for (const m of methods) if (m !== "HEAD") missing.push(`${m} ${r.url}`);
  }
  return missing;
}
