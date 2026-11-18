import { sessionQueueSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { sessionQueue } from "infra/queue/panel";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validate(sessionQueueSchema, await sessionQueue(await panelContext(req), pathId(req, "sessionId"))),
  );
}
