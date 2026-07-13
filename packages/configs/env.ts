import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import dotEnvExpand from "dotenv-expand";
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production", "staging"]).default("development"),
  API_URL: z.string(),
  WEB_URL: z.string(),
});

const NODE_ENV = envSchema.pick({ NODE_ENV: true }).parse(process.env).NODE_ENV;
const envFilename = `.env.${NODE_ENV}`;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const envFile = path.resolve(rootDir, envFilename);

dotEnvExpand.expand(dotenv.config({ path: envFile }));
dotEnvExpand.expand(dotenv.config({ path: `${envFile}.local`, override: true }));

export const env = envSchema.parse(process.env);
