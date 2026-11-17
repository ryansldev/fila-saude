import { allowedOrigin, panelOrigin } from "infra/panel/origin";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug: a } = await orchestrator.createMunicipality());
});
afterAll(() => orchestrator.dropMunicipalities());

describe("CORS do painel", () => {
  it("origemPermitida: só a origem do painel do mesmo slug do Host", () => {
    const cfg = { template: "http://{slug}.localhost:3000", mode: "multi" as const, domainBase: "localhost" };
    expect(allowedOrigin("http://pref-a.localhost:3000", "pref-a.localhost:3333", cfg)).toBe(true);
    expect(allowedOrigin("http://pref-b.localhost:3000", "pref-a.localhost:3333", cfg)).toBe(false);
    expect(allowedOrigin("http://evil.com", "pref-a.localhost:3333", cfg)).toBe(false);
    expect(allowedOrigin("http://pref-a.localhost:3000", "localhost:3333", cfg)).toBe(false);
  });

  it("PD-12: no modo single o Host é ignorado (VPS com domínio próprio) e vale a origem do painel do município", () => {
    const cfg = {
      template: "https://fila.prefeitura.gov.br",
      mode: "single" as const,
      domainBase: "localhost",
      fixedSlug: "pref-a",
    };
    expect(allowedOrigin("https://fila.prefeitura.gov.br", "api.prefeitura.gov.br", cfg)).toBe(true);
    expect(allowedOrigin("https://evil.com", "api.prefeitura.gov.br", cfg)).toBe(false);
  });

  it("T2.1: login pela origem do painel devolve CORS com credenciais", async () => {
    const cookie = await orchestrator.loginManager(a);
    const r = await orchestrator.panelRequest(a, "GET", "/v1/panel/me", { cookie });
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe(panelOrigin(a));
    expect(r.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("PD-24: preflight 204; origem desconhecida sem CORS", async () => {
    const pre = await fetch(`${orchestrator.tenantOrigin(a)}/v1/panel/units`, {
      method: "OPTIONS",
      headers: {
        origin: panelOrigin(a),
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "content-type",
      },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toContain("PATCH");
    const outside = await fetch(`${orchestrator.tenantOrigin(a)}/v1/panel/me`, {
      headers: { origin: "http://evil.com" },
    });
    expect(outside.headers.get("access-control-allow-origin")).toBeNull();
  });
});
