import { defineConfig } from "drizzle-kit";
import env from "./infra/env";

export default defineConfig({
  schema: "./infra/database/central/schema",
  out: "./infra/database/central/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
