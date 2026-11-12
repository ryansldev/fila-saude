import { construirApp } from "./app";

const app = await construirApp();

try {
  await app.listen({ port: 3333, host: "localhost" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
