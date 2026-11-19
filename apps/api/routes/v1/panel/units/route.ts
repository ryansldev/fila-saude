import { unitInputSchema, unitSchema } from "@fila-saude/schemas/unit";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UNITS_AND_RULES } from "infra/config/common";
import { createUnit, listUnits } from "infra/config/units";
import { panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import z from "zod";

// T2.2: unidades do município.
export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const create = panelSchema({ summary: "Criar unidade", body: unitInputSchema, response: { 201: unitSchema } });
  typed.post("/", { config: { action: UNITS_AND_RULES }, schema: create }, async (req, reply) =>
    reply.status(201).send(await createUnit(await panelContext(req), req.body)),
  );
  const list = panelSchema({ summary: "Unidades do município", response: { 200: z.array(unitSchema) } });
  typed.get("/", { schema: list }, async (req) => listUnits(await panelContext(req)));
}
