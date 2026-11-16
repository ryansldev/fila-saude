import { itemDeLigacaoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { ligacaoDaUnidade } from "infra/fila/agendamento";
import { contextoDoPainel } from "infra/painel/acao";
import z from "zod";

// RN-CONF-03: lista de ligação da unidade.
export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validar(
      z.array(itemDeLigacaoSchema),
      await ligacaoDaUnidade(await contextoDoPainel(req), idDoCaminho(req, "unidadeId")),
    ),
  );
}
