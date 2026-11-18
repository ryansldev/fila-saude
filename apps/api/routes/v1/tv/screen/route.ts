import { tvStateSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import { ApiError, validate } from "infra/errors";
import { tvScreen } from "infra/tv/tv";

// RN-TV-02: sem o token de uma TV pareada (ou aguardando), nada da unidade (PD-48: consulta a cada 2 s).
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.requireTenant] }, async (req) => {
    if (!req.tenant) throw new ApiError(404, "unknown_municipality");
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    return validate(tvStateSchema, await tvScreen(req.tenant.db, req.tenant.slug, token, Date.now()));
  });
}
