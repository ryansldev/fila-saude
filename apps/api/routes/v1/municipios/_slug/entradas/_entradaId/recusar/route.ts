import { respostaRegistradaSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { responderDoPaciente } from "infra/fila/lista-espera";

// RN-CONF-01/04: resposta à alocação pelo app, só da conta responsável.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req) => {
    const { db, paciente } = doPaciente(req);
    return validar(
      respostaRegistradaSchema,
      await responderDoPaciente(db, paciente.pacienteId, idDoCaminho(req, "entradaId"), "recusou", Date.now()),
    );
  });
}
