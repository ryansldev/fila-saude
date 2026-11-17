import { todaySummarySchema } from "@fila-saude/schemas/unit";
import type { FastifyInstance } from "fastify";
import { todaySummary } from "infra/config/units";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";
import { requireLogin } from "infra/panel/guard";
import z from "zod";

// Troca de unidade no menu: o que acontece hoje em cada unidade que a pessoa vê.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: requireLogin }, async (req) =>
    validate(z.array(todaySummarySchema), await todaySummary(await panelContext(req))),
  );
}
