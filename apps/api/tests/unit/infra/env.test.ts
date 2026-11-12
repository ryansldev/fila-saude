import { envSchema } from "infra/env";
import { describe, expect, it } from "vitest";

const base = {
  NODE_ENV: "test",
  POSTGRES_USER: "postgres",
  POSTGRES_PASSWORD: "postgres",
  POSTGRES_DB: "fila_central",
  POSTGRES_PORT: "5433",
  POSTGRES_HOST: "localhost",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/fila_central",
  TENANT_DATABASE_URL_TEMPLATE: "postgresql://postgres:postgres@localhost:5433/{banco}",
  TENANT_BASE_DOMAIN: "localhost",
  CENTRAL_URL: "http://localhost:3333",
  MAILER: "banco",
  TENANT_CACHE_TTL_MS: "0",
};

describe("envSchema", () => {
  it("PD-12: TENANT_MODE=single sem TENANT_SLUG é recusado com erro em TENANT_SLUG", () => {
    const resultado = envSchema.safeParse({ ...base, TENANT_MODE: "single" });
    expect(resultado.success).toBe(false);
    const problema = resultado.error?.issues.find((issue) => issue.path.join(".") === "TENANT_SLUG");
    expect(problema?.message).toMatch(/TENANT_SLUG/);
    expect(problema?.message).toMatch(/single/);
  });

  it("PD-12: TENANT_MODE=single com TENANT_SLUG é aceito", () => {
    const resultado = envSchema.safeParse({ ...base, TENANT_MODE: "single", TENANT_SLUG: "pref-a" });
    expect(resultado.success).toBe(true);
  });

  it("PD-12: TENANT_MODE=single com TENANT_SLUG fora do formato é recusado", () => {
    const resultado = envSchema.safeParse({ ...base, TENANT_MODE: "single", TENANT_SLUG: "Pref_A" });
    expect(resultado.success).toBe(false);
  });

  it("PD-15: modo multi não exige TENANT_SLUG", () => {
    expect(envSchema.safeParse({ ...base, TENANT_MODE: "multi" }).success).toBe(true);
    expect(envSchema.safeParse(base).success).toBe(true);
  });
});
