import { stationOperationSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { stationOperation } from "infra/queue/station";

export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validate(stationOperationSchema, await stationOperation(await panelContext(req), pathId(req, "stationId"))),
  );
}
