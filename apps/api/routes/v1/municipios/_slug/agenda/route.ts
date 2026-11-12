import { sessaoDaAgendaSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { ErroApi, validar } from "infra/erros";
import { agenda } from "infra/fila/app";

function dbDoTenant(req: FastifyRequest) {
  if (!req.tenant) throw new ErroApi(404, "municipio_desconhecido");
  return req.tenant.db;
}

import z from "zod";

export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.exigirTenant] }, async (req) =>
    validar(z.array(sessaoDaAgendaSchema), await agenda(dbDoTenant(req), Date.now())),
  );
}
