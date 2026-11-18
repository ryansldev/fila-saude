import type { FastifyInstance } from "fastify";
import { listRoutesWithoutSchema } from "infra/openapi/coverage";

// DOC2: rotas da /v1 sem `schema` no app que está no ar.
export default async function (app: FastifyInstance) {
  app.get("/", async () => listRoutesWithoutSchema(app));
}
