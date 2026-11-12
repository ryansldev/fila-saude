import type { FastifyInstance } from "fastify";
import { EQUIPE, idDoCaminho } from "infra/config/comum";
import { removerUsuario } from "infra/config/usuarios";
import { contextoDoPainel } from "infra/painel/acao";

// RN-PERF-04: remover alguém da equipe.
export default async function (app: FastifyInstance) {
  app.delete("/", { config: { acao: EQUIPE } }, async (req, reply) => {
    await removerUsuario(await contextoDoPainel(req), idDoCaminho(req, "usuarioId"));
    return reply.status(204).send();
  });
}
