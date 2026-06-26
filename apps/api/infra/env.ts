import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const NODE_ENV = z.enum(["development", "production", "test", "staging"]).parse(process.env.NODE_ENV ?? "development");

const envFilename = `.env.${NODE_ENV}`;

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const envFile = path.resolve(rootDir, envFilename);

dotenv.config({ path: envFile });

const envSchema = z.object({
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  POSTGRES_PORT: z.string(),
  POSTGRES_HOST: z.string(),
  DATABASE_URL: z.string(),
});

const env = envSchema.parse(process.env);

export default env;