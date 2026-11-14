import { tvRegistroSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import { ErroApi, validar } from "infra/erros";
import { registrarTv } from "infra/tv/tv";

// PD-47 / RN-TV-01: a TV abre `/tv` no subdomínio do município e se registra para ganhar o código.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant] }, async (req, reply) => {
    if (!req.tenant) throw new ErroApi(404, "municipio_desconhecido");
    return reply.status(201).send(validar(tvRegistroSchema, await registrarTv(req.tenant.db, Date.now())));
  });
}
