import { staffMeSchema } from "@fila-saude/schemas/auth";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ApiError } from "infra/errors";
import { panelSchema } from "infra/openapi/schemas";
import { staffUser } from "infra/panel/session";

// T1.9 / RN-PERF-01: quem está logado e os perfis com escopo.
export default async function (app: FastifyInstance) {
  const schema = panelSchema({ summary: "Quem está logado", response: { 200: staffMeSchema } });
  app.withTypeProvider<ZodTypeProvider>().get("/", { schema }, async (req) => {
    const user = await staffUser(req);
    if (!user) throw new ApiError(401, "not_authenticated");
    return user;
  });
}
