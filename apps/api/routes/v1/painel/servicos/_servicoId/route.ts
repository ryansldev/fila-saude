import { servicoEdicaoSchema, servicoSchema } from "@fila-saude/schemas/servico";
import type { FastifyInstance } from "fastify";
import { CONFIGURAR, idDoCaminho } from "infra/config/comum";
import { editarServico } from "infra/config/servicos";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.patch("/", { config: { acao: CONFIGURAR } }, async (req) => {
    const dados = validar(servicoEdicaoSchema, req.body);
    return validar(
      servicoSchema,
      await editarServico(await contextoDoPainel(req), idDoCaminho(req, "servicoId"), dados),
    );
  });
}
