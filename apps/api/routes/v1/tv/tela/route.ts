import { tvEstadoSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import { ErroApi, validar } from "infra/erros";
import { telaDaTv } from "infra/tv/tv";

// RN-TV-02: sem o token de uma TV pareada (ou aguardando), nada da unidade (PD-48: consulta a cada 2 s).
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.exigirTenant] }, async (req) => {
    if (!req.tenant) throw new ErroApi(404, "municipio_desconhecido");
    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    return validar(tvEstadoSchema, await telaDaTv(req.tenant.db, req.tenant.slug, token, Date.now()));
  });
}
