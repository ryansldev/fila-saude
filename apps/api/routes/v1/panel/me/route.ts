import { staffMeSchema } from "@fila-saude/schemas/auth";
import type { FastifyInstance } from "fastify";
import { validate } from "infra/errors";
import { requireLogin } from "infra/panel/guard";
import { staffUser } from "infra/panel/session";

// T1.9 / RN-PERF-01: quem está logado e os perfis com escopo.
export default async function (app: FastifyInstance) {
  app.get("/", { preHandler: requireLogin }, async (req) => validate(staffMeSchema, await staffUser(req)));
}
