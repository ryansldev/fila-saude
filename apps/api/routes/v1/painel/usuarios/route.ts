import { usuarioPainelEntradaSchema, usuarioPainelSchema } from "@fila-saude/schemas/usuario";
import type { FastifyInstance } from "fastify";
import { GESTAO } from "infra/config/comum";
import { criarUsuario, listarUsuarios } from "infra/config/usuarios";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigir } from "infra/painel/guard";

// T2.2: usuários do painel com perfis por unidade.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: GESTAO } }, async (req, reply) => {
    const dados = validar(usuarioPainelEntradaSchema, req.body);
    const u = await criarUsuario(await contextoDoPainel(req), dados);
    return reply.status(201).send(validar(usuarioPainelSchema, u));
  });

  app.get("/", { preHandler: exigir(GESTAO) }, async (req) => listarUsuarios(await contextoDoPainel(req)));
}
