import { sessaoEdicaoSchema, sessaoSchema } from "@fila-saude/schemas/sessao";
import type { FastifyInstance } from "fastify";
import { CONFIGURAR, idDoCaminho } from "infra/config/comum";
import { editarSessao } from "infra/config/sessoes";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.patch("/", { config: { acao: CONFIGURAR } }, async (req) => {
    const dados = validar(sessaoEdicaoSchema, req.body);
    return validar(sessaoSchema, await editarSessao(await contextoDoPainel(req), idDoCaminho(req, "sessaoId"), dados));
  });
}
