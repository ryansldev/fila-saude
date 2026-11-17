import { attendanceInputSchema, sessionQueueSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { markAttendanceInQueue } from "infra/queue/panel";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: "verify_and_mark_attendance" } }, async (req) =>
    validate(
      sessionQueueSchema,
      await markAttendanceInQueue(
        await panelContext(req),
        pathId(req, "sessionId"),
        validate(attendanceInputSchema, req.body),
        req.tenant?.municipalityId ?? null,
      ),
    ),
  );
}
