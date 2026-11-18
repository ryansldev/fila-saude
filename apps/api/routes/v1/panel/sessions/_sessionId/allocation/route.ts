import { sessionAllocationSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { sessionAllocation } from "infra/queue/scheduling";

// T5.3: vagas, alocados e a sugestão da sessão para o agendador.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Vagas e sugestão de alocação da sessão",
    params: idParams("sessionId"),
    response: { 200: sessionAllocationSchema },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .get("/", { schema }, async (req) => sessionAllocation(await panelContext(req), req.params.sessionId));
}
