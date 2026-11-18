import type { FastifyInstance } from "fastify";
import { openApiDocumentsOf } from "infra/openapi/document";

// AD-068: os documentos OpenAPI de cada versão do app que está no ar (os mesmos que `npm run
// docs:openapi` grava).
export default async function (app: FastifyInstance) {
  app.get("/", async () => openApiDocumentsOf(app));
}
