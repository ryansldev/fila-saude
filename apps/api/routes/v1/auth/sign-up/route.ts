import { STATUS_CODES } from "node:http";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { SignUpRequestSchema, SignUpResponseSchema } from "@fila-saude/schemas/auth";
import { ErrorResponseSchema } from "@fila-saude/schemas/common";
import { APIError } from "better-auth";
import { auth } from "infra/auth";
import { normalizeResponse } from "utils/serialization";

const signUpRoute: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/",
    {
      schema: {
        body: SignUpRequestSchema,
        response: {
          201: SignUpResponseSchema,
          default: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password, name, rememberMe, callbackURL } = request.body;

      try {
        const { headers, response: session } = await auth.api.signUpEmail({
          body: {
            email,
            password,
            name,
            rememberMe,
            callbackURL,
          },
          returnHeaders: true,
        });

        const response = SignUpResponseSchema.safeParse({
          token: session.token,
          user: {
            email: session.user.email,
            name: session.user.name,
            id: session.user.id,
            created_at: session.user.createdAt.toISOString(),
            updated_at: session.user.updatedAt.toISOString(),
            email_verified: session.user.emailVerified,
            image: session.user.image,
          },
        });

        if (!response.success) {
          return reply.status(400).send({
            status: 400,
            message: STATUS_CODES[400] ?? "Bad Request",
            error: response?.error?.message,
          });
        }

        reply.header("set-cookie", headers.getSetCookie());
        return reply.status(201).send(normalizeResponse(response.data));
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

export default signUpRoute;
