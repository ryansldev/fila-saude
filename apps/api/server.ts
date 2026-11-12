import path from "node:path";
import { fileURLToPath } from "node:url";
import autoload from "@fastify/autoload";
import Fastify from "fastify";
import { naoEncontrado, tratarErro } from "infra/erros";

const app = Fastify({
  logger: true,
});

const raiz = path.dirname(fileURLToPath(import.meta.url));

app.setErrorHandler(tratarErro);
app.setNotFoundHandler(naoEncontrado);

app.register(autoload, { dir: path.join(raiz, "routes") });

// PD-19: rotas só de teste nunca existem fora de NODE_ENV=test.
if (process.env.NODE_ENV === "test") {
  app.register(autoload, { dir: path.join(raiz, "test-routes"), options: { prefix: "/v1/teste" } });
}

try {
  await app.listen({ port: 3333, host: "localhost" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
