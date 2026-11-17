import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.createMunicipality());
});
afterAll(() => orchestrator.dropMunicipalities());

const me = (s: string, cookie?: string) =>
  fetch(`${webserver.origin}/v1/test/municipalities/${s}/patient/me`, { headers: cookie ? { cookie } : {} });

describe("GET /v1/test/municipalities/:slug/patient/me", () => {
  it("PD-33 / RN-ID-05: sessão do paciente da central autentica e chega não verificada", async () => {
    const { cookie, patientId, data } = await orchestrator.loginPatient();
    const r = await me(slug, cookie);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ patientId, cpf: data.cpf, verified: false });
  });

  it("sem cookie → 401; cookie adulterado → 401", async () => {
    expect((await me(slug)).status).toBe(401);
    expect((await me(slug, "better-auth.session_token=lixo.assinatura")).status).toBe(401);
  });

  it("cookie do painel não autentica como paciente", async () => {
    const cookie = await orchestrator.loginManager(slug);
    expect((await me(slug, cookie)).status).toBe(401);
  });

  it("PD-15: município desconhecido com sessão válida → 404", async () => {
    const { cookie } = await orchestrator.loginPatient();
    expect((await me("nao-existe-mesmo", cookie)).status).toBe(404);
  });
});
