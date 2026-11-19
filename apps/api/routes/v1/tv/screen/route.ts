import { tvStateSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ApiError } from "infra/errors";
import { apiErrors, HOST_TENANT_ERRORS, TAGS, TV } from "infra/openapi/schemas";
import { tvScreen } from "infra/tv/tv";

// RN-TV-02: sem o token de uma TV pareada (ou aguardando), nada da unidade (PD-48: consulta a cada 2 s).
export default async function (app: FastifyInstance) {
  const schema = {
    tags: [TAGS.tv],
    summary: "Tela da TV (pareamento ou chamadas)",
    security: TV,
    response: { 200: tvStateSchema, ...apiErrors(HOST_TENANT_ERRORS, { 401: ["tv_not_paired"] }) },
  };
  app.withTypeProvider<ZodTypeProvider>().get("/", { preValidation: [app.requireTenant], schema }, async (req) => {
    if (!req.tenant) throw new ApiError(404, "unknown_municipality");
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    return tvScreen(req.tenant.db, req.tenant.slug, token, Date.now());
  });
}
