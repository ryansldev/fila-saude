import { atribuicoesSchema, usuarioPainelSchema } from "@fila-saude/schemas/usuario";
import type { FastifyInstance } from "fastify";
import { EQUIPE, idDoCaminho } from "infra/config/comum";
import { trocarAtribuicoes } from "infra/config/usuarios";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";

// RN-PERF-04: ocupações e funções de quem já está na equipe.
export default async function (app: FastifyInstance) {
  app.put("/", { config: { acao: EQUIPE } }, async (req) => {
    const dados = validar(atribuicoesSchema, req.body);
    const usuarioId = idDoCaminho(req, "usuarioId");
    return validar(usuarioPainelSchema, await trocarAtribuicoes(await contextoDoPainel(req), usuarioId, dados));
  });
}
