import { hojeNaUnidadeSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { hojeNaUnidade } from "infra/fila/painel";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validar(hojeNaUnidadeSchema, await hojeNaUnidade(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"))),
  );
}
