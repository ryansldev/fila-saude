import type { FastifyInstance } from "fastify";
import { idDoCaminho } from "infra/config/comum";
import { configDaUnidade, podeVerUnidade } from "infra/config/unidades";
import { ErroApi } from "infra/erros";
import { contextoDoPainel } from "infra/painel/acao";
import { exigirLogin } from "infra/painel/guard";

// PD-28 / PD-35: configuração efetiva com a origem de cada valor.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: exigirLogin }, async (req) => {
    const ctx = await contextoDoPainel(req);
    const id = idDoCaminho(req, "unidadeId");
    if (!podeVerUnidade(ctx, id)) throw new ErroApi(403, "sem_permissao");
    return configDaUnidade(ctx, id);
  });
}
