import { stationEditSchema, stationSchema } from "@fila-saude/schemas/station";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFIGURE } from "infra/config/common";
import { archiveStation, editStation } from "infra/config/stations";
import { DOMAIN_CONFLICT, idParams, NO_CONTENT, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const params = idParams("stationId");
  const edit = panelSchema({
    summary: "Editar a estação",
    params,
    body: stationEditSchema,
    response: { 200: stationSchema },
    errors: { 404: ["not_found"] },
  });
  typed.patch("/", { config: { action: CONFIGURE }, schema: edit }, async (req) =>
    editStation(await panelContext(req), req.params.stationId, req.body),
  );
  const archive = panelSchema({
    summary: "Arquivar a estação",
    params,
    response: { 204: NO_CONTENT },
    errors: { 404: ["not_found"], 409: DOMAIN_CONFLICT },
  });
  typed.delete("/", { config: { action: CONFIGURE }, schema: archive }, async (req, reply) => {
    await archiveStation(await panelContext(req), req.params.stationId);
    return reply.status(204).send(null);
  });
}
