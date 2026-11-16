import { filaDeHojeSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { filaDeHoje } from "infra/fila/painel";
import { contextoDoPainel } from "infra/painel/acao";

// Fila do dia (caminho C): a unidade inteira, para quem é da equipe dela (F1).
export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validar(filaDeHojeSchema, await filaDeHoje(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"))),
  );
}
