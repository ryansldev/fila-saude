import { tvRecordSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import { ApiError, validate } from "infra/errors";
import { registerTv } from "infra/tv/tv";

// PD-47 / RN-TV-01: a TV abre `/tv` no subdomínio do município e se registra para ganhar o código.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.requireTenant] }, async (req, reply) => {
    if (!req.tenant) throw new ApiError(404, "unknown_municipality");
    return reply.status(201).send(validate(tvRecordSchema, await registerTv(req.tenant.db, Date.now())));
  });
}
