import { filaDaSessaoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho, SESSAO } from "infra/config/comum";
import { validar } from "infra/erros";
import { abrirSessaoDoDia } from "infra/fila/painel";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: SESSAO } }, async (req) =>
    validar(filaDaSessaoSchema, await abrirSessaoDoDia(await contextoDoPainel(req), idDoCaminho(req, "sessaoId"))),
  );
}
