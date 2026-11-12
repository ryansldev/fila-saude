import { municipioPublicoSchema } from "@fila-saude/schemas/fila";
import type { FastifyInstance } from "fastify";
import { validar } from "infra/erros";
import { municipiosAtivos } from "infra/fila/app";
import z from "zod";

// O app escolhe o município (AD-028: um app só para todos).
export default async function (app: FastifyInstance) {
  app.get("/", async () => validar(z.array(municipioPublicoSchema), await municipiosAtivos()));
}
