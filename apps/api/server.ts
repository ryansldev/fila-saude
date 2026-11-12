import env from "infra/env";
import { construirApp } from "./app";

const app = await construirApp();

try {
  await app.listen({ port: env.PORTA, host: "localhost" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
