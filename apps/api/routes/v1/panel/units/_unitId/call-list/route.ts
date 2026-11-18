import { callListItemSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { unitCallList } from "infra/queue/scheduling";
import z from "zod";

// RN-CONF-03: lista de ligação da unidade.
export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validate(z.array(callListItemSchema), await unitCallList(await panelContext(req), pathId(req, "unitId"))),
  );
}
