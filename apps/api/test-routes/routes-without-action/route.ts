import type { FastifyInstance } from "fastify";
import { listRoutesWithoutAction } from "infra/panel/action";

// PD-19 / PD-18: mutações do painel sem `config.acao` no app que está no ar.
export default async function (app: FastifyInstance) {
  app.get("/", async () => listRoutesWithoutAction(app));
}
