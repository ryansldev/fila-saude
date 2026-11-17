import { assignmentsSchema, staffUserSchema } from "@fila-saude/schemas/user";
import type { FastifyInstance } from "fastify";
import { pathId, STAFF } from "infra/config/common";
import { switchAssignments } from "infra/config/users";
import { validate } from "infra/errors";
import { panelContext } from "infra/panel/action";

// RN-PERF-04: ocupações e funções de quem já está na equipe.
export default async function (app: FastifyInstance) {
  app.put("/", { config: { action: STAFF } }, async (req) => {
    const data = validate(assignmentsSchema, req.body);
    const userId = pathId(req, "userId");
    return validate(staffUserSchema, await switchAssignments(await panelContext(req), userId, data));
  });
}
