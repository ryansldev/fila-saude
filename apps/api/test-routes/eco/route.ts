import type { FastifyInstance } from "fastify";
import { ApiError, validate } from "infra/errors";
import { z } from "zod";

// PD-19: rota só de teste (NODE_ENV=test) para exercitar validação e formato de erro.
const ecoSchema = z.object({ text: z.string().min(1), times: z.number().int() });

export default async function (app: FastifyInstance) {
  app.post("/", async (req) => {
    const body = validate(ecoSchema, req.body);
    if (body.text === "negocio") throw new ApiError(409, "test_conflict");
    if (body.text === "interno") throw new Error("segredo do servidor");
    return body;
  });
}
