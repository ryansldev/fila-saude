import { sessaoEntradaSchema, sessaoSchema } from "@fila-saude/schemas/sessao";
import type { FastifyInstance } from "fastify";
import { CONFIGURAR, idDoCaminho } from "infra/config/comum";
import { criarSessao, listarSessoes } from "infra/config/sessoes";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigir } from "infra/painel/guard";
import { z } from "zod";

const intervaloSchema = z.object({ de: z.iso.datetime({ offset: true }), ate: z.iso.datetime({ offset: true }) });

export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: CONFIGURAR } }, async (req, reply) => {
    const dados = validar(sessaoEntradaSchema, req.body);
    const s = await criarSessao(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"), dados);
    return reply.status(201).send(validar(sessaoSchema, s));
  });

  app.get("/", { preHandler: exigir(CONFIGURAR, { unidade: (req) => idDoCaminho(req, "unidadeId") }) }, async (req) => {
    const { de, ate } = validar(intervaloSchema, req.query);
    return listarSessoes(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"), {
      de: new Date(de),
      ate: new Date(ate),
    });
  });
}
