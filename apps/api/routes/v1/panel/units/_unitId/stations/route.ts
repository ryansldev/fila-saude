import { stationInputSchema, stationSchema } from "@fila-saude/schemas/station";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFIGURE } from "infra/config/common";
import { createStation, listStations } from "infra/config/stations";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { canConfigureUnit } from "infra/panel/guard";
import z from "zod";

export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const params = idParams("unitId");
  const create = panelSchema({
    summary: "Criar estação na unidade",
    params,
    body: stationInputSchema,
    response: { 201: stationSchema },
    errors: { 404: ["not_found"] },
  });
  typed.post("/", { config: { action: CONFIGURE }, schema: create }, async (req, reply) =>
    reply.status(201).send(await createStation(await panelContext(req), req.params.unitId, req.body)),
  );
  const list = panelSchema({ summary: "Estações da unidade", params, response: { 200: z.array(stationSchema) } });
  typed.get("/", { preHandler: canConfigureUnit, schema: list }, async (req) =>
    listStations(await panelContext(req), req.params.unitId),
  );
}
