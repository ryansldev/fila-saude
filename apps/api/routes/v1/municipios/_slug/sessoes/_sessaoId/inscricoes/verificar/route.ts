import { inscricaoEntradaSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { verificarInscricao } from "infra/fila/app";

// Na escolha de "para quem", antes do questionário: recusa já o que a inscrição recusaria, sem gravar.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req) => {
    const { db, paciente } = doPaciente(req);
    const { paraQuem } = validar(inscricaoEntradaSchema.pick({ paraQuem: true }), req.body);
    return verificarInscricao(db, paciente, idDoCaminho(req, "sessaoId"), paraQuem, Date.now());
  });
}
