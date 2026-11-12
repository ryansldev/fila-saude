import { unidadeEntradaSchema, unidadeSchema } from "@fila-saude/schemas/unidade";
import type { FastifyInstance } from "fastify";
import { UNIDADES_E_REGRAS } from "infra/config/comum";
import { criarUnidade, listarUnidades } from "infra/config/unidades";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigirLogin } from "infra/painel/guard";

// T2.2: unidades do município.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: UNIDADES_E_REGRAS } }, async (req, reply) => {
    const dados = validar(unidadeEntradaSchema, req.body);
    const u = await criarUnidade(await contextoDoPainel(req), dados);
    return reply.status(201).send(validar(unidadeSchema, u));
  });

  app.get("/", { preHandler: exigirLogin }, async (req) => listarUnidades(await contextoDoPainel(req)));
}
