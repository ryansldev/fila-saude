import { inscricaoEntradaSchema, inscricaoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { entrarNaListaPeloApp } from "infra/fila/lista-espera";

// T5.1: entrar na lista de espera do serviço pelo app.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req, reply) => {
    const { db, paciente } = doPaciente(req);
    const r = await entrarNaListaPeloApp(
      db,
      paciente,
      idDoCaminho(req, "servicoId"),
      validar(inscricaoEntradaSchema, req.body),
      Date.now(),
    );
    return reply.code(201).send(validar(inscricaoSchema, r));
  });
}
