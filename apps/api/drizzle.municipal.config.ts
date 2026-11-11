import { defineConfig } from "drizzle-kit";
import env from "./infra/env";

// PD-16: um conjunto de migrations para todos os bancos `fila_t_<slug>`.
// `generate` não conecta; a URL só serve aos comandos do drizzle-kit que olham um banco.
export default defineConfig({
  schema: "./infra/database/municipal/schema",
  out: "./infra/database/municipal/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.TENANT_DATABASE_URL_TEMPLATE.replace("{banco}", "fila_t_dev"),
  },
});
