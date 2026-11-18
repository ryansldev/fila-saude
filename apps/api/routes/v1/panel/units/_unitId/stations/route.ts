import { stationInputSchema, stationSchema } from "@fila-saude/schemas/station";
import type { FastifyInstance } from "fastify";
import { CONFIGURE, pathId } from "infra/config/common";
import { createStation, listStations } from "infra/config/stations";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { require } from "infra/panel/guard";

export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: CONFIGURE } }, async (req, reply) => {
    const data = validate(stationInputSchema, req.body);
    const e = await createStation(await panelContext(req), pathId(req, "unitId"), data);
    return reply.status(201).send(validate(stationSchema, e));
  });

  app.get("/", { preHandler: require(CONFIGURE, { unit: (req) => pathId(req, "unitId") }) }, async (req) =>
    listStations(await panelContext(req), pathId(req, "unitId")),
  );
}
