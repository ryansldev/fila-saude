import type { FastifyInstance } from "fastify";
import { pacienteDaRequisicao } from "infra/auth/sessao-paciente";
import database from "infra/database";
import { dispositivoPush } from "infra/database/central/schema/push";
import { validar } from "infra/erros";
import z from "zod";

const entrada = z.object({ token: z.string().min(10).max(300) });

// T3.8: o app registra o token de push do aparelho na conta (central; vale para todos os municípios).
// O mesmo aparelho logado em outra conta passa a avisar só a conta nova.
export default async function (app: FastifyInstance) {
  app.put("/", { preHandler: [app.exigirPaciente] }, async (req) => {
    const { pacienteId } = pacienteDaRequisicao(req);
    const { token } = validar(entrada, req.body);
    await database
      .insert(dispositivoPush)
      .values({ pacienteId, token })
      .onConflictDoUpdate({ target: dispositivoPush.token, set: { pacienteId, atualizadoEm: new Date() } });
    return { ok: true };
  });
}
