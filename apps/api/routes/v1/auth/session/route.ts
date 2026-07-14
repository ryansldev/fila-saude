import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { GetSessionResponseSchema } from "@fila-saude/schemas/auth";
import { ErrorResponseSchema } from "@fila-saude/schemas/common";
import { auth } from "infra/auth";
import { normalizeResponse } from "utils/serialization";

const sessionRoute: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/",
    {
      schema: {
        response: {
          200: GetSessionResponseSchema,
          default: ErrorResponseSchema,
        },
      },
    },
    async (req, res) => {
      const session = await auth.api.getSession({
        headers: req.headers,
      });

      const response = GetSessionResponseSchema.parse(normalizeResponse(session));

      return res.status(200).send(response);
    },
  );
};

export default sessionRoute;
