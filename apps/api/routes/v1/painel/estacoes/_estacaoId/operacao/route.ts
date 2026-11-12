import { operacaoEstacaoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { operacaoDaEstacao } from "infra/fila/estacao";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validar(operacaoEstacaoSchema, await operacaoDaEstacao(await contextoDoPainel(req), idDoCaminho(req, "estacaoId"))),
  );
}
