import { stationEditSchema, stationSchema } from "@fila-saude/schemas/station";
import type { FastifyInstance } from "fastify";
import { CONFIGURE, pathId } from "infra/config/common";
import { archiveStation, editStation } from "infra/config/stations";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  app.patch("/", { config: { action: CONFIGURE } }, async (req) => {
    const data = validate(stationEditSchema, req.body);
    return validate(stationSchema, await editStation(await panelContext(req), pathId(req, "stationId"), data));
  });

  app.delete("/", { config: { action: CONFIGURE } }, async (req, reply) => {
    await archiveStation(await panelContext(req), pathId(req, "stationId"));
    return reply.status(204).send();
  });
}
