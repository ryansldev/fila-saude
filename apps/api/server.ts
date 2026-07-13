import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATUS_CODES } from "node:http";
import autoload from "@fastify/autoload";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  serializerCompiler,
  validatorCompiler,
} from "@fastify/type-provider-zod";
import Fastify, { type FastifyError } from "fastify";

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.setErrorHandler((error, _request, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      status: 400,
      message: STATUS_CODES[400] ?? "Bad Request",
      error: error.validation.map((issue) => issue.message).join("; "),
    });
  }

  if (isResponseSerializationError(error)) {
    return reply.status(500).send({
      status: 500,
      message: STATUS_CODES[500] ?? "Internal Server Error",
      error: "Response doesn't match the schema",
    });
  }

  const status = (error as FastifyError).statusCode ?? 500;

  return reply.status(status).send({
    status,
    message: STATUS_CODES[status] ?? "Internal Server Error",
    error: error instanceof Error ? error.message : "Internal Server Error",
  });
});

app.register(autoload, {
  dir: path.join(path.dirname(fileURLToPath(import.meta.url)), "routes"),
});

try {
  await app.listen({ port: 3333 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
