import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

// PD-19 / PD-22: a mesma rota de `eco`, mas com o schema declarado no Fastify (DOC2).
const ecoSchema = z.object({
  text: z.string().min(1),
  times: z.number().int(),
  phone: z
    .string()
    .transform((t) => t.replace(/\D/g, ""))
    .optional(),
});
const answerSchema = z.object({ text: z.string(), times: z.number().int(), phone: z.string().optional() });

export default async function (app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { schema: { body: ecoSchema, response: { 200: answerSchema } } }, async (req) => {
      // Resposta fora do schema: bug do servidor (500), não erro de quem chamou.
      if (req.body.text === "wrong-answer") return { text: 1 } as never;
      return req.body;
    });
}
