import { estacaoEdicaoSchema, estacaoSchema } from "@fila-saude/schemas/estacao";
import type { FastifyInstance } from "fastify";
import { CONFIGURAR, idDoCaminho } from "infra/config/comum";
import { arquivarEstacao, editarEstacao } from "infra/config/estacoes";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.patch("/", { config: { acao: CONFIGURAR } }, async (req) => {
    const dados = validar(estacaoEdicaoSchema, req.body);
    return validar(
      estacaoSchema,
      await editarEstacao(await contextoDoPainel(req), idDoCaminho(req, "estacaoId"), dados),
    );
  });

  app.delete("/", { config: { acao: CONFIGURAR } }, async (req, reply) => {
    await arquivarEstacao(await contextoDoPainel(req), idDoCaminho(req, "estacaoId"));
    return reply.status(204).send();
  });
}
