import { pairingInputSchema, tvRefSchema, unitTvSchema } from "@fila-saude/schemas/tv";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { CONFIGURE } from "infra/config/common";
import { idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";
import { canConfigureUnit } from "infra/panel/guard";
import { pairTv, unitTvs } from "infra/tv/tv";
import z from "zod";

// RN-TV-01 / RN-TV-06: o admin pareia pelo código e vê se cada TV está online.
export default async function (app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const params = idParams("unitId");
  const pair = panelSchema({
    summary: "Parear uma TV pelo código",
    params,
    body: pairingInputSchema,
    response: { 201: tvRefSchema },
    errors: { 404: ["invalid_code"] },
  });
  typed.post("/", { config: { action: CONFIGURE }, schema: pair }, async (req, reply) =>
    reply.status(201).send(await pairTv(await panelContext(req), req.params.unitId, req.body.code)),
  );
  const list = panelSchema({ summary: "TVs da unidade", params, response: { 200: z.array(unitTvSchema) } });
  typed.get("/", { preHandler: canConfigureUnit, schema: list }, async (req) =>
    unitTvs(await panelContext(req), req.params.unitId),
  );
}
