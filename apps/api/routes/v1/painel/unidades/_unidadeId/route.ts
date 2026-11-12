import { unidadeEdicaoSchema, unidadeSchema } from "@fila-saude/schemas/unidade";
import type { FastifyInstance } from "fastify";
import { idDoCaminho, UNIDADES_E_REGRAS } from "infra/config/comum";
import { editarUnidade, lerUnidade, podeVerUnidade, removerUnidade } from "infra/config/unidades";
import { ErroApi, validar } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigirLogin } from "infra/painel/guard";

export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: exigirLogin }, async (req) => {
    const ctx = await contextoDoPainel(req);
    const id = idDoCaminho(req, "unidadeId");
    if (!podeVerUnidade(ctx, id)) throw new ErroApi(403, "sem_permissao");
    return lerUnidade(ctx, id);
  });

  app.patch("/", { config: { acao: UNIDADES_E_REGRAS } }, async (req) => {
    const dados = validar(unidadeEdicaoSchema, req.body);
    const u = await editarUnidade(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"), dados);
    return validar(unidadeSchema, u);
  });

  app.delete("/", { config: { acao: UNIDADES_E_REGRAS } }, async (req, reply) => {
    await removerUnidade(await contextoDoPainel(req), idDoCaminho(req, "unidadeId"));
    return reply.status(204).send();
  });
}
