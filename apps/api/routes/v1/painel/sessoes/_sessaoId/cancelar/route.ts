import { sessaoSchema } from "@fila-saude/schemas/sessao";
import type { FastifyInstance } from "fastify";
import { idDoCaminho, SESSAO } from "infra/config/comum";
import { cancelarSessao } from "infra/config/sessoes";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: SESSAO } }, async (req) =>
    validar(sessaoSchema, await cancelarSessao(await contextoDoPainel(req), idDoCaminho(req, "sessaoId"))),
  );
}
