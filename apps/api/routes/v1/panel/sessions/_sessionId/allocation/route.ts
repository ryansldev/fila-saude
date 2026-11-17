import { sessionAllocationSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { sessionAllocation } from "infra/queue/scheduling";

// T5.3: vagas, alocados e a sugestão da sessão para o agendador.
export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validate(sessionAllocationSchema, await sessionAllocation(await panelContext(req), pathId(req, "sessionId"))),
  );
}
