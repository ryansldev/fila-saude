import { isIP } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import dotEnvExpand from "dotenv-expand";
import { z } from "zod";
import { validateSlug } from "./tenant/slug";

// Nomes que o `trustProxy` do Fastify conhece (proxy-addr), para o proxy na mesma máquina ou na rede interna.
const PROXY_NAMES = new Set(["loopback", "linklocal", "uniquelocal"]);

// "IP", "IP/prefixo" (prefixo dentro da família: 32 no IPv4, 128 no IPv6) ou um dos nomes acima.
function validProxy(entry: string): boolean {
  if (PROXY_NAMES.has(entry)) return true;
  const [ip = "", prefix, ...rest] = entry.split("/");
  const family = isIP(ip);
  if (family === 0 || rest.length > 0) return false;
  if (prefix === undefined) return true;
  return /^\d+$/.test(prefix) && Number(prefix) <= (family === 4 ? 32 : 128);
}

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
  // Segredo do better-auth; a contagem de tentativas (NC5) também o usa para o HMAC das chaves.
  BETTER_AUTH_SECRET: z.string().min(1),
  // PD-39 / PD-24: origem do painel de cada município (`{slug}` trocado pelo slug), para CORS e trustedOrigins.
  PANEL_ORIGIN_TEMPLATE: z.string().includes("{slug}").default("http://{slug}.localhost:3000"),
  // AD-062: chaves do Cloudflare Turnstile (painel da Cloudflare). O padrão são as de teste, que sempre
  // passam; em produção são recusadas.
  TURNSTILE_SITE_KEY: z.string().min(1).default("1x00000000000000000000AA"),
  TURNSTILE_SECRET_KEY: z.string().min(1).default("1x0000000000000000000000000000000AA"),
  // NC5: proxies reversos (Caddy, nginx) cujo X-Forwarded-For a API aceita, separados por vírgula (IP ou
  // faixa). Vazio: nenhum, e vale o IP da conexão. Atrás de um proxy sem isso, todos parecem o proxy.
  TRUSTED_PROXIES: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
    .refine(
      (entries) => entries.every(validProxy),
      "TRUSTED_PROXIES: cada item é um IP, uma faixa (IP/prefixo) ou loopback, linklocal, uniquelocal",
    ),
});

// Chaves de teste da Cloudflare começam por 1x, 2x ou 3x seguido de zeros.
const TURNSTILE_TEST_KEY = /^[123]x0{10,}/;

// PD-12: no modo `single` o processo atende um município só; sem TENANT_SLUG válido e
// TENANT_DATABASE_URL o boot falha. AD-062: em produção, o Turnstile precisa das chaves de verdade.
export const envSchema = envFields.superRefine((values, ctx) => {
  if (values.NODE_ENV === "production") {
    for (const key of ["TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] as const) {
      if (TURNSTILE_TEST_KEY.test(values[key]))
        ctx.addIssue({ code: "custom", path: [key], message: `${key} de teste não vale em produção (AD-062)` });
    }
  }
  if (values.TENANT_MODE !== "single") {
    // No modo multi um TENANT_SLUG esquecido no ambiente faria a varredura atender só esse município.
    if (values.TENANT_SLUG)
      ctx.addIssue({ code: "custom", path: ["TENANT_SLUG"], message: "TENANT_SLUG só vale com TENANT_MODE=single" });
    return;
  }
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
