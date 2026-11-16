import { servicoDaUnidadeSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { ErroApi, validar } from "infra/erros";
import { servicosDaUnidade } from "infra/fila/lista-espera";
import z from "zod";

// I1: pública, como a agenda (sem dado de paciente).
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.exigirTenant] }, async (req) => {
    if (!req.tenant) throw new ErroApi(404, "municipio_desconhecido");
    return validar(
      z.array(servicoDaUnidadeSchema),
      await servicosDaUnidade(req.tenant.db, idDoCaminho(req, "unidadeId")),
    );
  });
}
