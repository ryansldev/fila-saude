import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signInRequestSchema, signInResponseSchema } from "@fila-saude/schemas/auth";
import { auth } from "infra/auth";
import { keysToSnakeCase } from "utils/serialization";

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

      const { headers, response } = await auth.api.signInEmail({
        headers: req.headers,
        body: {
          email,
          password,
        },
        returnHeaders: true,
      });

      const responseBody = signInResponseSchema.parse(keysToSnakeCase(response));

      res.header("set-cookie", headers.getSetCookie());
      return res.status(200).send(responseBody);
    },
  );
};

export default signInRoute;
