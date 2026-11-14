import { pareamentoEntradaSchema, tvDaUnidadeSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import { CONFIGURAR, idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigir } from "infra/painel/guard";
import { parearTv, tvsDaUnidade } from "infra/tv/tv";
import z from "zod";

// RN-TV-01 / RN-TV-06: o admin pareia pelo código e vê se cada TV está online.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: CONFIGURAR } }, async (req, reply) => {
    const { codigo } = validar(pareamentoEntradaSchema, req.body);
    const r = await parearTv(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"), codigo);
    return reply.status(201).send(r);
  });

  app.get("/", { preHandler: exigir(CONFIGURAR, { unidade: (req) => idDoCaminho(req, "unidadeId") }) }, async (req) =>
    validar(z.array(tvDaUnidadeSchema), await tvsDaUnidade(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"))),
  );
}
