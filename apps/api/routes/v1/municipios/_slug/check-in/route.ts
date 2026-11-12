import { checkInEntradaSchema, checkInSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { validar } from "infra/erros";
import { checkInDoPaciente } from "infra/fila/qr";

// RN-PRES-01: check-in pelo QR, só com a conta do paciente (RNF-SEG-01).
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req) => {
    const { db, paciente } = doPaciente(req);
    const { unidadeId, tokens } = validar(checkInEntradaSchema, req.body);
    return validar(checkInSchema, await checkInDoPaciente(db, paciente, unidadeId, tokens, Date.now()));
  });
}
