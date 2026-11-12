import { servicoEntradaSchema, servicoSchema } from "@fila-saude/schemas/servico";
import type { FastifyInstance } from "fastify";
import { CONFIGURAR, idDoCaminho } from "infra/config/comum";
import { criarServico, listarServicos } from "infra/config/servicos";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigir } from "infra/painel/guard";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: CONFIGURAR } }, async (req, reply) => {
    const dados = validar(servicoEntradaSchema, req.body);
    const s = await criarServico(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"), dados);
    return reply.status(201).send(validar(servicoSchema, s));
  });

  app.get("/", { preHandler: exigir(CONFIGURAR, { unidade: (req) => idDoCaminho(req, "unidadeId") }) }, async (req) =>
    listarServicos(await contextoDoPainel(req), idDoCaminho(req, "unidadeId")),
  );
}
