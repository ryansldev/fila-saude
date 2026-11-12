import { origemDoPainel, origemPermitida } from "infra/painel/origem";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug: a } = await orchestrator.criarMunicipio());
});
afterAll(() => orchestrator.derrubarMunicipios());

describe("CORS do painel", () => {
  it("origemPermitida: só a origem do painel do mesmo slug do Host", () => {
    const cfg = { template: "http://{slug}.localhost:3000", dominioBase: "localhost" };
    expect(origemPermitida("http://pref-a.localhost:3000", "pref-a.localhost:3333", cfg)).toBe(true);
    expect(origemPermitida("http://pref-b.localhost:3000", "pref-a.localhost:3333", cfg)).toBe(false);
    expect(origemPermitida("http://evil.com", "pref-a.localhost:3333", cfg)).toBe(false);
    expect(origemPermitida("http://pref-a.localhost:3000", "localhost:3333", cfg)).toBe(false);
  });

  it("T2.1: login pela origem do painel devolve CORS com credenciais", async () => {
    const cookie = await orchestrator.loginGestor(a);
    const r = await orchestrator.pedirPainel(a, "GET", "/v1/painel/eu", { cookie });
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe(origemDoPainel(a));
    expect(r.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("PD-24: preflight 204; origem desconhecida sem CORS", async () => {
    const pre = await fetch(`${orchestrator.origemDoTenant(a)}/v1/painel/unidades`, {
      method: "OPTIONS",
      headers: {
        origin: origemDoPainel(a),
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "content-type",
      },
    });
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toContain("PATCH");
    const fora = await fetch(`${orchestrator.origemDoTenant(a)}/v1/painel/eu`, {
      headers: { origin: "http://evil.com" },
    });
    expect(fora.headers.get("access-control-allow-origin")).toBeNull();
  });
});
