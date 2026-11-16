import { alocacaoDaSessaoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { alocacaoDaSessao } from "infra/fila/agendamento";
import { contextoDoPainel } from "infra/painel/acao";

// T5.3: vagas, alocados e a sugestão da sessão para o agendador.
export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validar(alocacaoDaSessaoSchema, await alocacaoDaSessao(await contextoDoPainel(req), idDoCaminho(req, "sessaoId"))),
  );
}
