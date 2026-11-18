import { pairingInputSchema, unitTvSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import { CONFIGURE, pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { require } from "infra/panel/guard";
import { pairTv, unitTvs } from "infra/tv/tv";
import z from "zod";

// RN-TV-01 / RN-TV-06: o admin pareia pelo código e vê se cada TV está online.
export default async function (app: FastifyInstance) {
  app.post("/", { config: { action: CONFIGURE } }, async (req, reply) => {
    const { code } = validate(pairingInputSchema, req.body);
    const r = await pairTv(await panelContext(req), pathId(req, "unitId"), code);
    return reply.status(201).send(r);
  });

  app.get("/", { preHandler: require(CONFIGURE, { unit: (req) => pathId(req, "unitId") }) }, async (req) =>
    validate(z.array(unitTvSchema), await unitTvs(await panelContext(req), pathId(req, "unitId"))),
  );
}
