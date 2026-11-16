import { resumoDeHojeSchema } from "@fila-saude/schemas/unidade";
import type { FastifyInstance } from "fastify";
import { resumoDeHoje } from "infra/config/unidades";
import { validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigirLogin } from "infra/painel/guard";
import z from "zod";

// Troca de unidade no menu: o que acontece hoje em cada unidade que a pessoa vê.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: exigirLogin }, async (req) =>
    validar(z.array(resumoDeHojeSchema), await resumoDeHoje(await contextoDoPainel(req))),
  );
}
