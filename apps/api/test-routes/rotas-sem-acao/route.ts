import type { FastifyInstance } from "fastify";
import { listarRotasSemAcao } from "infra/painel/acao";

// PD-19 / PD-18: mutações do painel sem `config.acao` no app que está no ar.
export default async function (app: FastifyInstance) {
  app.get("/", async () => listarRotasSemAcao(app));
}
