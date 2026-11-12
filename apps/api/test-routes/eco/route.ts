import type { FastifyInstance } from "fastify";
import { ErroApi, validar } from "infra/erros";
import { z } from "zod";

// PD-19: rota só de teste (NODE_ENV=test) para exercitar validação e formato de erro.
const ecoSchema = z.object({ texto: z.string().min(1), vezes: z.number().int() });

export default async function (app: FastifyInstance) {
  app.post("/", async (req) => {
    const corpo = validar(ecoSchema, req.body);
    if (corpo.texto === "negocio") throw new ErroApi(409, "conflito_de_teste");
    if (corpo.texto === "interno") throw new Error("segredo do servidor");
    return corpo;
  });
}
