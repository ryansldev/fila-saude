import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { idDoCaminho } from "infra/config/comum";
import { cancelarDoPaciente } from "infra/fila/app";

// RN-CANC-01: "Não vou poder ir", só pela conta responsável pela entrada.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req) => {
    const { db, paciente } = doPaciente(req);
    return cancelarDoPaciente(db, paciente.pacienteId, idDoCaminho(req, "entradaId"), Date.now());
  });
}
