import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import dotEnvExpand from "dotenv-expand";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
  VERCEL_URL: z.string().optional(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  POSTGRES_PORT: z.string(),
  POSTGRES_HOST: z.string(),
  DATABASE_URL: z.string(),
  // PD-14: URL do banco de cada município; `{banco}` é trocado por `fila_t_<slug>`.
  TENANT_DATABASE_URL_TEMPLATE: z.string().includes("{banco}"),
  // PD-15: painel e TV em `<slug>.<TENANT_BASE_DOMAIN>`.
  TENANT_BASE_DOMAIN: z.string().min(1),
  // PD-12: `single` fixa o tenant por TENANT_SLUG (VPS do município).
  TENANT_MODE: z.enum(["multi", "single"]).default("multi"),
  TENANT_SLUG: z.string().min(1).optional(),
  TENANT_DATABASE_URL: z.string().min(1).optional(),
  // PD-17: emissor do JWT do paciente e origem do JWKS.
  CENTRAL_URL: z.string().min(1),
  // PD-20: `banco` grava os e-mails em `correio_dev` no central.
  MAILER: z.enum(["banco", "smtp"]),
  TENANT_CACHE_TTL_MS: z.coerce.number().int().nonnegative(),
  AUTH_JWT_TTL: z.string().min(1).default("15m"),
});

const NODE_ENV = envSchema.pick({ NODE_ENV: true }).parse(process.env).NODE_ENV;

const envFilename = `.env.${NODE_ENV}`;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envFile = path.resolve(rootDir, envFilename);

dotEnvExpand.expand(dotenv.config({ path: envFile }));

const env = envSchema.parse(process.env);

export default env;
