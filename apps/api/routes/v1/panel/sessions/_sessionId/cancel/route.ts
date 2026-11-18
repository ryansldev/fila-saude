import { sessionSchema } from "@fila-saude/schemas/session";
import type { FastifyInstance } from "fastify";
import { pathId, SESSION } from "infra/config/common";
import { cancelSession } from "infra/config/sessions";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: SESSION } }, async (req) =>
    validate(sessionSchema, await cancelSession(await panelContext(req), pathId(req, "sessionId"))),
  );
}
