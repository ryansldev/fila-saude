import { estacaoEntradaSchema, estacaoSchema } from "@fila-saude/schemas/estacao";
import type { FastifyInstance } from "fastify";
import { CONFIGURAR, idDoCaminho } from "infra/config/comum";
import { criarEstacao, listarEstacoes } from "infra/config/estacoes";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigir } from "infra/painel/guard";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: CONFIGURAR } }, async (req, reply) => {
    const dados = validar(estacaoEntradaSchema, req.body);
    const e = await criarEstacao(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"), dados);
    return reply.status(201).send(validar(estacaoSchema, e));
  });

  app.get("/", { preHandler: exigir(CONFIGURAR, { unidade: (req) => idDoCaminho(req, "unidadeId") }) }, async (req) =>
    listarEstacoes(await contextoDoPainel(req), idDoCaminho(req, "unidadeId")),
  );
}
