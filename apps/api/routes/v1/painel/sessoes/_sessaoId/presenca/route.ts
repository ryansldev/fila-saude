import { filaDaSessaoSchema, presencaEntradaSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { marcarPresencaNaFila } from "infra/fila/painel";
import { contextoDoPainel } from "infra/painel/acao";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { acao: "conferir_e_marcar_presenca" } }, async (req) =>
    validar(
      filaDaSessaoSchema,
      await marcarPresencaNaFila(
        await contextoDoPainel(req),
        idDoCaminho(req, "sessaoId"),
        validar(presencaEntradaSchema, req.body),
        req.tenant?.municipioId ?? null,
      ),
    ),
  );
}
