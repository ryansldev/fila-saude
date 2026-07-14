import { STATUS_CODES } from "node:http";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signInRequestSchema, signInResponseSchema } from "@fila-saude/schemas/auth";
import { errorResponseSchema } from "@fila-saude/schemas/common";
import { APIError } from "better-auth";
import { auth } from "infra/auth";
import { normalizeResponse } from "utils/serialization";

const signInRoute: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/",
    {
      schema: {
        body: signInRequestSchema,
        response: {
          200: signInResponseSchema,
          default: errorResponseSchema,
        },
      },
    },
    async (req, reply) => {
      try {
        const { email, password } = req.body;

        const { headers, response } = await auth.api.signInEmail({
          headers: req.headers,
          body: {
            email,
            password,
          },
          returnHeaders: true,
        });

        console.log("AQUI É O RESPONSE", normalizeResponse(response));
        const responseBody = signInResponseSchema.parse(normalizeResponse(response));

        reply.header("set-cookie", headers.getSetCookie());
        return reply.status(200).send(responseBody);
      } catch (error) {
        if (error instanceof APIError) {
          return reply.status(error.statusCode).send({
            status: error.statusCode,
            message: STATUS_CODES[error.statusCode] ?? String(error.status),
            error: error.body?.message ?? error.message,
          });
        }

        throw error;
      }
    },
  );
};

export default signInRoute;
