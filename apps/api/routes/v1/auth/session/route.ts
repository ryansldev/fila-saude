import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { getSessionResponseSchema } from "@fila-saude/schemas/auth";
import { errorResponseSchema } from "@fila-saude/schemas/common";
import { auth } from "infra/auth";
import { keysToSnakeCase } from "utils/serialization";

const sessionRoute: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/",
    {
      schema: {
        response: {
          200: getSessionResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (req, res) => {
      const session = await auth.api.getSession({
        headers: req.headers,
      });

      const response = getSessionResponseSchema.parse(keysToSnakeCase(session));

      return res.status(200).send(response);
    },
  );
};

export default sessionRoute;
