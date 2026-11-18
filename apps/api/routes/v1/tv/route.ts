import { tvRecordSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ApiError } from "infra/errors";
import { apiErrors, TAGS, TENANT_ERRORS } from "infra/openapi/schemas";
import { registerTv } from "infra/tv/tv";

// PD-47 / RN-TV-01: a TV abre `/tv` no subdomínio do município e se registra para ganhar o código.
export default async function (app: FastifyInstance) {
  const schema = {
    tags: [TAGS.tv],
    summary: "Registrar a TV (ganha o código de pareamento e o token)",
    response: { 201: tvRecordSchema, ...apiErrors(TENANT_ERRORS, { 503: ["try_again"] }) },
  };
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { preValidation: [app.requireTenant], schema }, async (req, reply) => {
      if (!req.tenant) throw new ApiError(404, "unknown_municipality");
      return reply.status(201).send(await registerTv(req.tenant.db, Date.now()));
    });
}
