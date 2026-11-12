import { filaDaSessaoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { filaDaSessao } from "infra/fila/painel";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validar(filaDaSessaoSchema, await filaDaSessao(await contextoDoPainel(req), idDoCaminho(req, "sessaoId"))),
  );
}
