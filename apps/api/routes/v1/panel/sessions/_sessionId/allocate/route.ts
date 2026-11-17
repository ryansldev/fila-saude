import { allocateInputSchema, sessionAllocationSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { allocateSession, SCHEDULE } from "infra/queue/scheduling";

// T5.3 / RN-AL-04: o agendador aloca; o segundo a chegar recebe 409 com a lista atualizada (I7).
export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: SCHEDULE } }, async (req) => {
    const { entryId } = validate(allocateInputSchema, req.body);
    return validate(
      sessionAllocationSchema,
      await allocateSession(await panelContext(req), pathId(req, "sessionId"), entryId),
    );
  });
}
