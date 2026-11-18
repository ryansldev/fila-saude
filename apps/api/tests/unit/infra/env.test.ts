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
  TENANT_DATABASE_URL_TEMPLATE: "postgresql://postgres:postgres@localhost:5433/{database}",
  TENANT_BASE_DOMAIN: "localhost",
  CENTRAL_URL: "http://localhost:3333",
  MAILER: "database",
  TENANT_CACHE_TTL_MS: "0",
};

const single = {
  TENANT_MODE: "single",
  TENANT_SLUG: "pref-a",
  TENANT_DATABASE_URL: "postgresql://postgres:postgres@localhost:5433/fila_t_pref_a",
};

describe("envSchema", () => {
  it("PD-12: TENANT_MODE=single sem TENANT_SLUG é recusado com erro em TENANT_SLUG", () => {
    const result = envSchema.safeParse({ ...base, TENANT_MODE: "single" });
    expect(result.success).toBe(false);
    const problem = result.error?.issues.find((issue) => issue.path.join(".") === "TENANT_SLUG");
    expect(problem?.message).toMatch(/TENANT_SLUG/);
    expect(problem?.message).toMatch(/single/);
  });

  it("PD-12: TENANT_MODE=single com TENANT_SLUG e TENANT_DATABASE_URL é aceito", () => {
    const result = envSchema.safeParse({ ...base, ...single });
    expect(result.success).toBe(true);
    expect(result.data?.TENANT_TIME_ZONE).toBe("America/Sao_Paulo");
  });

  it("PD-12: TENANT_MODE=single sem TENANT_DATABASE_URL é recusado com erro em TENANT_DATABASE_URL", () => {
    const result = envSchema.safeParse({ ...base, TENANT_MODE: "single", TENANT_SLUG: "pref-a" });
    expect(result.success).toBe(false);
    const problem = result.error?.issues.find((issue) => issue.path.join(".") === "TENANT_DATABASE_URL");
    expect(problem?.message).toMatch(/TENANT_DATABASE_URL/);
  });

  it("PD-12: TENANT_TIME_ZONE informado é mantido", () => {
    const result = envSchema.safeParse({ ...base, ...single, TENANT_TIME_ZONE: "America/Recife" });
    expect(result.data?.TENANT_TIME_ZONE).toBe("America/Recife");
  });

  it("PD-12: TENANT_MODE=single com TENANT_SLUG fora do formato é recusado", () => {
    const result = envSchema.safeParse({ ...base, ...single, TENANT_SLUG: "Pref_A" });
    expect(result.success).toBe(false);
  });

  it("PD-15: modo multi não exige TENANT_SLUG", () => {
    expect(envSchema.safeParse({ ...base, TENANT_MODE: "multi" }).success).toBe(true);
    expect(envSchema.safeParse(base).success).toBe(true);
  });

  it("PD-12: TENANT_SLUG sobrando no modo multi é recusado (a varredura atenderia só esse município)", () => {
    const r = envSchema.safeParse({ ...base, TENANT_MODE: "multi", TENANT_SLUG: "pref-a" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["TENANT_SLUG"]);
  });
  it("NC5: TRUSTED_PROXIES vazio quer dizer nenhum proxy (a API usa o IP da conexão)", () => {
    expect(envSchema.parse(base).TRUSTED_PROXIES).toEqual([]);
  });

  it("NC5: TRUSTED_PROXIES aceita IPs e faixas separados por vírgula", () => {
    const result = envSchema.parse({ ...base, TRUSTED_PROXIES: "127.0.0.1, 10.0.0.0/8,::1" });
    expect(result.TRUSTED_PROXIES).toEqual(["127.0.0.1", "10.0.0.0/8", "::1"]);
  });

  it("NC5: TRUSTED_PROXIES com item inválido é recusado (um erro de digitação não pode virar 'confiar em todos')", () => {
    const result = envSchema.safeParse({ ...base, TRUSTED_PROXIES: "127.0.0.1,caddy" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["TRUSTED_PROXIES"]);
    expect(envSchema.safeParse({ ...base, TRUSTED_PROXIES: "10.0.0.0/33" }).success).toBe(false);
  });

  it("NC5: TRUSTED_PROXIES aceita os nomes do Fastify (loopback, linklocal, uniquelocal)", () => {
    const result = envSchema.parse({ ...base, TRUSTED_PROXIES: "loopback,uniquelocal" });
    expect(result.TRUSTED_PROXIES).toEqual(["loopback", "uniquelocal"]);
  });
});
