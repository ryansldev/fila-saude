import { euPainelSchema } from "@fila-saude/schemas/auth";
import type { FastifyInstance } from "fastify";
import { validar } from "infra/erros";
import { exigirLogin } from "infra/painel/guard";
import { usuarioDoPainel } from "infra/painel/sessao";

// T1.9 / RN-PERF-01: quem está logado e os perfis com escopo.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: exigirLogin }, async (req) => validar(euPainelSchema, await usuarioDoPainel(req)));
}
