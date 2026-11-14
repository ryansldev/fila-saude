import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { idDoCaminho } from "infra/config/comum";
import { vouSairDoPaciente } from "infra/fila/app";

// RN-PRES-02: "Vou sair", de qualquer lugar, só pela conta responsável pela entrada.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req) => {
    const { db, paciente } = doPaciente(req);
    return vouSairDoPaciente(db, paciente.pacienteId, idDoCaminho(req, "entradaId"), Date.now());
  });
}
