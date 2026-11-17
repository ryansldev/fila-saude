import { sessionQueueSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId, SESSION } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { openDaySession } from "infra/queue/panel";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: SESSION } }, async (req) =>
    validate(sessionQueueSchema, await openDaySession(await panelContext(req), pathId(req, "sessionId"))),
  );
}
