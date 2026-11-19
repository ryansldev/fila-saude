import { sessionInputSchema, sessionSchema } from "@fila-saude/schemas/session";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFIGURE } from "infra/config/common";
import { createSession, listSessions } from "infra/config/sessions";
import { CONFLICT_CODES, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { canConfigureUnit } from "infra/panel/guard";
import z from "zod";

const intervalSchema = z.object({ from: z.iso.datetime({ offset: true }), until: z.iso.datetime({ offset: true }) });

export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const params = idParams("unitId");
  const create = panelSchema({
    summary: "Criar sessão na unidade",
    params,
    body: sessionInputSchema,
    response: { 201: sessionSchema },
    errors: { 404: ["not_found"], 409: CONFLICT_CODES },
  });
  typed.post("/", { config: { action: CONFIGURE }, schema: create }, async (req, reply) =>
    reply.status(201).send(await createSession(await panelContext(req), req.params.unitId, req.body)),
  );
  const list = panelSchema({
    summary: "Sessões da unidade num intervalo",
    params,
    querystring: intervalSchema,
    response: { 200: z.array(sessionSchema) },
  });
  typed.get("/", { preHandler: canConfigureUnit, schema: list }, async (req) =>
    listSessions(await panelContext(req), req.params.unitId, {
      from: new Date(req.query.from),
      until: new Date(req.query.until),
    }),
  );
}
