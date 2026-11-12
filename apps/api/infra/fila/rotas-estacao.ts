import { comandoEstacaoSchema, operacaoEstacaoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { comandoNaEstacao, OPERAR } from "./estacao";

// Uma rota por comando da estação (T3.7), todas com a mesma casca.
export function rotaDoComando(comando: string) {
  const cmd = validar(comandoEstacaoSchema, comando);
  return async (app: FastifyInstance) => {
    app.post("/", { config: { acao: OPERAR } }, async (req) =>
      validar(
        operacaoEstacaoSchema,
        await comandoNaEstacao(await contextoDoPainel(req), idDoCaminho(req, "estacaoId"), cmd),
      ),
    );
  };
}
