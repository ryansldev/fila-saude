import { effectiveConfigSchema } from "@fila-saude/schemas/unit";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { canSeeUnit, unitConfig } from "infra/config/units";
import { ApiError } from "infra/errors";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

// PD-28 / PD-35: configuração efetiva com a origem de cada valor.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Configuração efetiva da unidade",
    params: idParams("unitId"),
    response: { 200: effectiveConfigSchema },
    errors: { 404: ["not_found"] },
  });
  app.withTypeProvider<ZodTypeProvider>().get("/", { schema }, async (req) => {
    const ctx = await panelContext(req);
    if (!canSeeUnit(ctx, req.params.unitId)) throw new ApiError(403, "no_permission");
    return unitConfig(ctx, req.params.unitId);
  });
}
