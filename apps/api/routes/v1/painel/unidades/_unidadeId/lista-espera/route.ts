import { listaDeEsperaDoServicoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { validar } from "infra/erros";
import { listaDeEsperaDaUnidade } from "infra/fila/agendamento";
import { contextoDoPainel } from "infra/painel/acao";
import z from "zod";

// T5.3: lista de espera da unidade por serviço, com as sessões privadas que vêm.
export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validar(
      z.array(listaDeEsperaDoServicoSchema),
      await listaDeEsperaDaUnidade(await contextoDoPainel(req), idDoCaminho(req, "unidadeId")),
    ),
  );
}
