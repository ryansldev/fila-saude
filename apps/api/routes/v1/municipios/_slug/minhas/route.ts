import { minhaEntradaSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { validar } from "infra/erros";
import { minhas } from "infra/fila/app";
import z from "zod";

// PD-33: o app consulta a cada ~3 s; mesmo formato que o SSE terá.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req) => {
    const { db, paciente } = doPaciente(req);
    return validar(z.array(minhaEntradaSchema), await minhas(db, paciente.pacienteId, Date.now()));
  });
}
