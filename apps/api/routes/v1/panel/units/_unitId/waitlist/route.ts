import { serviceWaitlistSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { unitWaitlist } from "infra/queue/scheduling";
import z from "zod";

// T5.3: lista de espera da unidade por serviço, com as sessões privadas que vêm.
export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validate(z.array(serviceWaitlistSchema), await unitWaitlist(await panelContext(req), pathId(req, "unitId"))),
  );
}
