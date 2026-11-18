import { todayQueueSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import { pathId } from "infra/config/common";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { todayQueue } from "infra/queue/panel";

// Fila do dia (caminho C): a unidade inteira, para quem é da equipe dela (F1).
export default async function (app: FastifyInstance) {
  app.get("/", async (req) =>
    validate(todayQueueSchema, await todayQueue(await panelContext(req), pathId(req, "unitId"))),
  );
}
