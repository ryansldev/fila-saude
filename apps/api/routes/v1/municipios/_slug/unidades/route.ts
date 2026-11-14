import { unidadePublicaSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { ErroApi, validar } from "infra/erros";
import { unidadesDoMunicipio } from "infra/fila/app";
import z from "zod";

// Tela 5: pública, como a agenda (sem dado de paciente).
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.exigirTenant] }, async (req) => {
    if (!req.tenant) throw new ErroApi(404, "municipio_desconhecido");
    return validar(z.array(unidadePublicaSchema), await unidadesDoMunicipio(req.tenant.db, Date.now()));
  });
}
