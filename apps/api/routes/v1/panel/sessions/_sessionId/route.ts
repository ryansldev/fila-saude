import { sessionEditSchema, sessionSchema } from "@fila-saude/schemas/session";
import type { FastifyInstance } from "fastify";
import { CONFIGURE, pathId } from "infra/config/common";
import { editSession } from "infra/config/sessions";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  app.patch("/", { config: { action: CONFIGURE } }, async (req) => {
    const data = validate(sessionEditSchema, req.body);
    return validate(sessionSchema, await editSession(await panelContext(req), pathId(req, "sessionId"), data));
  });
}
