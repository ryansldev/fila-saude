import { sessionInputSchema, sessionSchema } from "@fila-saude/schemas/session";
import type { FastifyInstance } from "fastify";
import { CONFIGURE, pathId } from "infra/config/common";
import { createSession, listSessions } from "infra/config/sessions";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { require } from "infra/panel/guard";
import { z } from "zod";

const intervalSchema = z.object({ from: z.iso.datetime({ offset: true }), until: z.iso.datetime({ offset: true }) });

export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: CONFIGURE } }, async (req, reply) => {
    const data = validate(sessionInputSchema, req.body);
    const s = await createSession(await panelContext(req), pathId(req, "unitId"), data);
    return reply.status(201).send(validate(sessionSchema, s));
  });

  app.get("/", { preHandler: require(CONFIGURE, { unit: (req) => pathId(req, "unitId") }) }, async (req) => {
    const { from, until } = validate(intervalSchema, req.query);
    return listSessions(await panelContext(req), pathId(req, "unitId"), {
      from: new Date(from),
      until: new Date(until),
    });
  });
}
