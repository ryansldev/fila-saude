import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import dotEnvExpand from "dotenv-expand";
import { z } from "zod";
import { validateSlug } from "./tenant/slug";

const envFields = z.object({
  NODE_ENV: z.enum(["development", "production", "test", "staging"]).default("development"),
  // Porta da API. Os testes usam outra (3334) para rodar com o `npm run dev` no ar.
  PORT: z.coerce.number().int().positive().default(3333),
  // Endereço em que a API escuta; 0.0.0.0 para o celular na mesma rede alcançar em dev.
  HOST: z.string().default("localhost"),
  VERCEL_URL: z.string().optional(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_DB: z.string(),
  POSTGRES_PORT: z.string(),
  POSTGRES_HOST: z.string(),
  DATABASE_URL: z.string(),
  // PD-14: URL do banco de cada município; `{database}` é trocado por `fila_t_<slug>`.
  TENANT_DATABASE_URL_TEMPLATE: z.string().includes("{database}"),
  // PD-15: painel e TV em `<slug>.<TENANT_BASE_DOMAIN>`.
  TENANT_BASE_DOMAIN: z.string().min(1),
  // PD-12: `single` fixa o tenant por TENANT_SLUG (VPS do município).
  TENANT_MODE: z.enum(["multi", "single"]).default("multi"),
  TENANT_SLUG: z.string().min(1).optional(),
  // PD-12: no modo `single` o banco do município vem direto do ambiente, sem passar pelo central.
  TENANT_DATABASE_URL: z.string().min(1).optional(),
  // PD-12: fuso do município no modo `single` (o schema municipal não guarda o fuso; o central, sim).
  TENANT_TIME_ZONE: z.string().min(1).default("America/Sao_Paulo"),
  // PD-17: emissor do JWT do paciente e origem do JWKS.
  CENTRAL_URL: z.string().min(1),
  // PD-20: `database` guarda os e-mails no central em vez de enviar (dev e teste).
  MAILER: z.enum(["database", "smtp"]),
  TENANT_CACHE_TTL_MS: z.coerce.number().int().nonnegative(),
  AUTH_JWT_TTL: z.string().min(1).default("15m"),
  // PD-39 / PD-24: origem do painel de cada município (`{slug}` trocado pelo slug), para CORS e trustedOrigins.
  PANEL_ORIGIN_TEMPLATE: z.string().includes("{slug}").default("http://{slug}.localhost:3000"),
});

// PD-12: no modo `single` o processo atende um município só; sem TENANT_SLUG válido e
// TENANT_DATABASE_URL o boot falha.
export const envSchema = envFields.superRefine((values, ctx) => {
  if (values.TENANT_MODE !== "single") return;
  if (!values.TENANT_SLUG) {
    ctx.addIssue({
      code: "custom",
      path: ["TENANT_SLUG"],
      message: "TENANT_SLUG é obrigatório quando TENANT_MODE=single",
    });
  } else if (!validateSlug(values.TENANT_SLUG)) {
    ctx.addIssue({
      code: "custom",
      path: ["TENANT_SLUG"],
      message: "TENANT_SLUG fora do formato de slug (TENANT_MODE=single)",
    });
  }
  if (!values.TENANT_DATABASE_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["TENANT_DATABASE_URL"],
      message: "TENANT_DATABASE_URL é obrigatório quando TENANT_MODE=single",
    });
  }
});

const NODE_ENV = envFields.pick({ NODE_ENV: true }).parse(process.env).NODE_ENV;

const envFilename = `.env.${NODE_ENV}`;

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const envFile = path.resolve(rootDir, envFilename);

dotEnvExpand.expand(dotenv.config({ path: envFile }));

const env = envSchema.parse(process.env);

export default env;
