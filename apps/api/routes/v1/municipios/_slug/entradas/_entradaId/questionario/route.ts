import { questionarioEntradaSchema, questionarioRefeitoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { doPaciente } from "infra/auth/sessao-paciente";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { refazerQuestionarioDoPaciente } from "infra/fila/lista-espera";

// RN-RISCO-03 / I9: refazer o questionário de quem está na lista.
export default async function (app: FastifyInstance) {
  app.post("/", { preHandler: [app.exigirTenant, app.exigirPaciente] }, async (req) => {
    const { db, paciente } = doPaciente(req);
    const { respostas } = validar(questionarioEntradaSchema, req.body);
    return validar(
      questionarioRefeitoSchema,
      await refazerQuestionarioDoPaciente(
        db,
        paciente.pacienteId,
        idDoCaminho(req, "entradaId"),
        respostas,
        Date.now(),
      ),
    );
  });
}
