import path from "node:path";
import { fileURLToPath } from "node:url";
import autoload from "@fastify/autoload";
import Fastify from "fastify";

const app = Fastify({
  logger: true,
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
