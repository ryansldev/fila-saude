import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signInRequestSchema, signInResponseSchema } from "@fila-saude/schemas/auth";
import { auth } from "infra/auth";
import { user } from "infra/database/schemas/auth";

const signInRoute: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/",
    {
      schema: {
        body: signInRequestSchema,
        response: {
          200: signInResponseSchema,
        },
      },
    },
    async (req, res) => {
      const { email, password } = req.body;

      const response = await auth.api.signInEmail({
        headers: req.headers,
        body: {
          email,
          password,
        },
      });

      const responseBody = signInResponseSchema.parse({
        ...response,
        user: {
          ...response.user,
          updated_at: response.user.updatedAt.toISOString(),
          created_at: response.user.createdAt.toISOString(),
        },
      });

      return res.status(200).send(responseBody);
    },
  );
};

export default signInRoute;
