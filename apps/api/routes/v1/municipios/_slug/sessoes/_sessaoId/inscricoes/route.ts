import { inscricaoEntradaSchema, inscricaoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { inscreverPaciente } from "infra/fila/app";

export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req, reply) => {
    const { db, paciente } = doPaciente(req);
    const r = await inscreverPaciente(
      db,
      paciente,
      idDoCaminho(req, "sessaoId"),
      validar(inscricaoEntradaSchema, req.body),
      Date.now(),
    );
    return reply.code(201).send(validar(inscricaoSchema, r));
  });
}
