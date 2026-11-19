import { assignmentsSchema, staffUserSchema } from "@fila-saude/schemas/user";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { STAFF } from "infra/config/common";
import { switchAssignments } from "infra/config/users";
import { CONFLICT_CODES, idParams, panelSchema } from "infra/openapi/schemas";
import { panelContext } from "infra/panel/action";

// RN-PERF-04: ocupações e funções de quem já está na equipe.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({
    summary: "Trocar ocupações e funções",
    params: idParams("userId"),
    body: assignmentsSchema,
    response: { 200: staffUserSchema },
    errors: { 404: ["not_found"], 409: CONFLICT_CODES },
  });
  app
    .withTypeProvider<ZodTypeProvider>()
    .put("/", { config: { action: STAFF }, schema }, async (req) =>
      switchAssignments(await panelContext(req), req.params.userId, req.body),
    );
}
