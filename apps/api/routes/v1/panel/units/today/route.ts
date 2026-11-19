import { todaySummarySchema } from "@fila-saude/schemas/unit";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { todaySummary } from "infra/config/units";
import { panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import z from "zod";

// Troca de unidade no menu: o que acontece hoje em cada unidade que a pessoa vê.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({ summary: "Hoje em cada unidade", response: { 200: z.array(todaySummarySchema) } });
  app.withTypeProvider<ZodTypeProvider>().get("/", { schema }, async (req) => todaySummary(await panelContext(req)));
}
