import type { FastifyInstance } from "fastify";
import { CONFIGURAR, idDoCaminho } from "infra/config/comum";
import { contextoDoPainel } from "infra/painel/acao";
import { revogarTv } from "infra/tv/tv";

// RN-TV-01: revogada, a TV volta à tela de pareamento.
export default async function (app: FastifyInstance) {
  app.delete("/", { config: { acao: CONFIGURAR } }, async (req) =>
    revogarTv(await contextoDoPainel(req), idDoCaminho(req, "tvId")),
  );
}
