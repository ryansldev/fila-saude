import type { FastifyInstance } from "fastify";

// DOC2: o documento OpenAPI do app que está no ar (o mesmo que `npm run docs:openapi` grava).
export default async function (app: FastifyInstance) {
  app.get("/", async () => app.swagger());
}
