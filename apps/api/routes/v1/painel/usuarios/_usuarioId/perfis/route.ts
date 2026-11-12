import { perfisEntradaSchema, usuarioPainelSchema } from "@fila-saude/schemas/usuario";
import type { FastifyInstance } from "fastify";
import { GESTAO, idDoCaminho } from "infra/config/comum";
import { trocarPerfis } from "infra/config/usuarios";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.put("/", { config: { acao: GESTAO } }, async (req) => {
    const { perfis } = validar(perfisEntradaSchema, req.body);
    const usuarioId = idDoCaminho(req, "usuarioId");
    return validar(usuarioPainelSchema, await trocarPerfis(await contextoDoPainel(req), usuarioId, perfis));
  });
}
