import { attendanceInputSchema, sessionQueueSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { DOMAIN_CONFLICT, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { markAttendanceInQueue } from "infra/queue/panel";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Conferir e marcar a presença na fila",
    params: idParams("sessionId"),
    body: attendanceInputSchema,
    response: { 200: sessionQueueSchema },
    errors: { 404: ["not_found"], 409: DOMAIN_CONFLICT },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .post("/", { config: { action: "verify_and_mark_attendance" }, schema }, async (req) =>
      markAttendanceInQueue(
        await panelContext(req),
        req.params.sessionId,
        req.body,
        req.tenant?.municipalityId ?? null,
      ),
    );
}
