import database from "infra/database";
import env from "infra/env";
import { reservedMunicipalities } from "infra/tenant/reserved";
import { buildApp } from "./app";

const app = await buildApp();

try {
  // AD-069 / DA12: município com nome reservado (`api`, `www`…) sumiria sem aviso; melhor não subir.
  if (env.TENANT_MODE === "multi") {
    const reserved = await reservedMunicipalities(database);
    if (reserved.length > 0) throw new Error(`municípios com nome reservado no catálogo: ${reserved.join(", ")}`);
  }
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
