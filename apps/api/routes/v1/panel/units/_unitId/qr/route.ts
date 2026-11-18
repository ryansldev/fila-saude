import { unitQrSchema } from "@fila-saude/schemas/queue";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ApiError } from "infra/errors";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { unitQr } from "infra/queue/qr";

export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "QR de entrada da unidade",
    params: idParams("unitId"),
    response: { 200: unitQrSchema },
    errors: { 404: ["not_found"] },
  });
  app.withTypeProvider<ZodTypeProvider>().get("/", { schema }, async (req) => {
    const ctx = await panelContext(req);
    // O login do painel (hook) já resolveu o município; a checagem só estreita o tipo.
    if (!req.tenant) throw new ApiError(404, "unknown_municipality");
    return unitQr(ctx, req.tenant.slug, req.params.unitId);
  });
}
