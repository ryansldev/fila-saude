import { alocacaoDaSessaoSchema, alocarEntradaSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { AGENDAR, alocarNaSessao } from "infra/fila/agendamento";
import { contextoDoPainel } from "infra/painel/acao";

// T5.3 / RN-AL-04: o agendador aloca; o segundo a chegar recebe 409 com a lista atualizada (I7).
export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: AGENDAR } }, async (req) => {
    const { entradaId } = validar(alocarEntradaSchema, req.body);
    return validar(
      alocacaoDaSessaoSchema,
      await alocarNaSessao(await contextoDoPainel(req), idDoCaminho(req, "sessaoId"), entradaId),
    );
  });
}
