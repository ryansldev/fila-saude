import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signUpRequestSchema } from "@fila-saude/schemas/auth";

const signUpRoute: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/",
    {
      schema: {
        body: signUpRequestSchema,
      },
    },
    async (request, reply) => {
      const { email, password, name } = request.body;

      return reply.status(201).send({
        email,
        name,
        password,
      });
    },
  );
};

export default signUpRoute;
