import { usuarioPainelEntradaSchema, usuarioPainelSchema } from "@fila-saude/schemas/usuario";
import type { FastifyInstance } from "fastify";
import { EQUIPE } from "infra/config/comum";
import { criarUsuario, listarUsuarios } from "infra/config/usuarios";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigirLogin } from "infra/painel/guard";

// T2.2 / RN-PERF-04: a equipe do painel, com ocupações e funções.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: EQUIPE } }, async (req, reply) => {
    const dados = validar(usuarioPainelEntradaSchema, req.body);
    const u = await criarUsuario(await contextoDoPainel(req), dados);
    return reply.status(201).send(validar(usuarioPainelSchema, u));
  });

  app.get("/", { preHandler: exigirLogin }, async (req) => listarUsuarios(await contextoDoPainel(req)));
}
