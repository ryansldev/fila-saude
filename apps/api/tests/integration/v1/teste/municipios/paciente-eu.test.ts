import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.criarMunicipio());
});
afterAll(() => orchestrator.derrubarMunicipios());

const eu = (s: string, cookie?: string) =>
  fetch(`${webserver.origin}/v1/teste/municipios/${s}/paciente/eu`, { headers: cookie ? { cookie } : {} });

describe("GET /v1/teste/municipios/:slug/paciente/eu", () => {
  it("PD-33 / RN-ID-05: sessão do paciente da central autentica e chega não verificada", async () => {
    const { cookie, pacienteId, dados } = await orchestrator.loginPaciente();
    const r = await eu(slug, cookie);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ pacienteId, cpf: dados.cpf, verificado: false });
  });

  it("sem cookie → 401; cookie adulterado → 401", async () => {
    expect((await eu(slug)).status).toBe(401);
    expect((await eu(slug, "better-auth.session_token=lixo.assinatura")).status).toBe(401);
  });

  it("cookie do painel não autentica como paciente", async () => {
    const cookie = await orchestrator.loginGestor(slug);
    expect((await eu(slug, cookie)).status).toBe(401);
  });

  it("PD-15: município desconhecido com sessão válida → 404", async () => {
    const { cookie } = await orchestrator.loginPaciente();
    expect((await eu("nao-existe-mesmo", cookie)).status).toBe(404);
  });
});
