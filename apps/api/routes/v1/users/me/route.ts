import { STATUS_CODES } from "node:http";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { UpdateUserRequestSchema } from "@fila-saude/schemas/users";
import { APIError } from "better-auth";
import { auth } from "infra/auth";

const routes: FastifyPluginAsyncZod = async (server) => {
  server.patch(
    "/",
    {
      schema: {
        body: UpdateUserRequestSchema,
      },
    },
    async (req, res) => {
      try {
        const { name, image } = req.body;

        const { status } = await auth.api.updateUser({
          headers: req.headers,
          body: {
            name,
            image,
          },
        });

        return res.status(200).send({ status });
      } catch (error) {
        if (error instanceof APIError) {
          return res.status(error.statusCode).send({
            status: error.statusCode,
            message: STATUS_CODES[error.statusCode] ?? String(error.status),
            error: error.body?.message ?? error.message,
          });
        }

        return res.status(500).send({
          status: 500,
          message: STATUS_CODES[500] ?? "Internal Server Error",
          error: error instanceof Error ? error.message : "Internal Server Error",
        });
      }
    },
  );
};

export default routes;
