import { respostaDoAgendadorSchema, respostaRegistradaSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { AGENDAR, responderPeloAgendador } from "infra/fila/agendamento";
import { contextoDoPainel } from "infra/painel/acao";

// RN-CONF-02: confirmou, recusou ou sem contato, registrado pelo agendador depois de ligar.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: AGENDAR } }, async (req) => {
    const { resposta } = validar(respostaDoAgendadorSchema, req.body);
    return validar(
      respostaRegistradaSchema,
      await responderPeloAgendador(await contextoDoPainel(req), idDoCaminho(req, "entradaId"), resposta),
    );
  });
}
