import { tvRefSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFIGURE } from "infra/config/common";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { revokeTv } from "infra/tv/tv";

// RN-TV-01: revogada, a TV volta à tela de pareamento.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Revogar a TV",
    params: idParams("tvId"),
    response: { 200: tvRefSchema },
    errors: { 404: ["not_found"] },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .delete("/", { config: { action: CONFIGURE }, schema }, async (req) =>
      revokeTv(await panelContext(req), req.params.tvId),
    );
}
