import { unitEditSchema, unitSchema } from "@fila-saude/schemas/unit";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { UNITS_AND_RULES } from "infra/config/common";
import { canSeeUnit, editUnit, readUnit, removeUnit } from "infra/config/units";
import { ApiError } from "infra/errors";
import { DOMAIN_CONFLICT, idParams, NO_CONTENT, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const params = idParams("unitId");
  const read = panelSchema({
    summary: "Unidade",
    params,
    response: { 200: unitSchema },
    errors: { 404: ["not_found"] },
  });
  typed.get("/", { schema: read }, async (req) => {
    const ctx = await panelContext(req);
    if (!canSeeUnit(ctx, req.params.unitId)) throw new ApiError(403, "no_permission");
    return readUnit(ctx, req.params.unitId);
  });
  const edit = panelSchema({
    summary: "Editar a unidade",
    params,
    body: unitEditSchema,
    response: { 200: unitSchema },
    errors: { 404: ["not_found"] },
  });
  typed.patch("/", { config: { action: UNITS_AND_RULES }, schema: edit }, async (req) =>
    editUnit(await panelContext(req), req.params.unitId, req.body),
  );
  const remove = panelSchema({
    summary: "Remover a unidade",
    params,
    response: { 204: NO_CONTENT },
    errors: { 404: ["not_found"], 409: DOMAIN_CONFLICT },
  });
  typed.delete("/", { config: { action: UNITS_AND_RULES }, schema: remove }, async (req, reply) => {
    await removeUnit(await panelContext(req), req.params.unitId);
    return reply.status(204).send(null);
  });
}
