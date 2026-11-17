import { sessionSchema, visibilityInputSchema } from "@fila-saude/schemas/session";
import type { FastifyInstance } from "fastify";
import { pathId, SESSION } from "infra/config/common";
import { changeSessionVisibility } from "infra/config/sessions";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: SESSION } }, async (req) => {
    const data = validate(visibilityInputSchema, req.body);
    const s = await changeSessionVisibility(await panelContext(req), pathId(req, "sessionId"), data);
    return validate(sessionSchema, s);
  });
}
