import database from "infra/database";
import env from "infra/env";
import { reservedMunicipalities } from "infra/tenant/reserved";
import { buildApp } from "./app";

const app = await buildApp();

try {
  // AD-069 / DA12: município com nome reservado (`api`, `www`…) fica sem o painel e a TV (o Host não
  // resolve); o app segue pelo caminho. Avisa no log, sem derrubar os outros municípios, para alguém renomear.
  // Num `try` próprio: é só um aviso, e o banco central fora do ar por um instante não impede a API de subir.
  if (env.TENANT_MODE === "multi") {
    try {
      const reserved = await reservedMunicipalities(database);
      if (reserved.length > 0) {
        app.log.error(
          { reserved },
          "municípios com nome reservado: o painel e a TV deles não resolvem pelo Host; renomeie",
        );
      }
    } catch (err) {
      app.log.error({ err }, "não deu para conferir os municípios com nome reservado");
    }
  }
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
