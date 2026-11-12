import { qrDaUnidadeSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { ErroApi, validar } from "infra/erros";
import { qrDaUnidade } from "infra/fila/qr";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) => {
    const ctx = await contextoDoPainel(req);
    if (!req.tenant) throw new ErroApi(404, "municipio_desconhecido");
    return validar(qrDaUnidadeSchema, await qrDaUnidade(ctx, req.tenant.slug, idDoCaminho(req, "unidadeId")));
  });
}
