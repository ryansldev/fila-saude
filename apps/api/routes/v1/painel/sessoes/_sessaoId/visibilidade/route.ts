import { sessaoSchema, visibilidadeEntradaSchema } from "@fila-saude/schemas/sessao";
import type { FastifyInstance } from "fastify";
import { idDoCaminho, SESSAO } from "infra/config/comum";
import { mudarVisibilidadeDaSessao } from "infra/config/sessoes";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: SESSAO } }, async (req) => {
    const dados = validar(visibilidadeEntradaSchema, req.body);
    const s = await mudarVisibilidadeDaSessao(await contextoDoPainel(req), idDoCaminho(req, "sessaoId"), dados);
    return validar(sessaoSchema, s);
  });
}
