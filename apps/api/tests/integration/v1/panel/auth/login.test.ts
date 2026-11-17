import { panelOrigin } from "infra/panel/origin";
import orchestrator, { MANAGER_PASSWORD } from "tests/orchestrator";
import { sms } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: string;
let b: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug: a } = await orchestrator.createMunicipality());
  ({ slug: b } = await orchestrator.createMunicipality());
});
afterAll(() => orchestrator.dropMunicipalities());

function enter(slug: string, login: string, password: string, origin = panelOrigin(slug)) {
  return fetch(`${orchestrator.tenantOrigin(slug)}/v1/panel/auth/sign-in/username`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: origin },
    body: JSON.stringify({ username: login, password: password }),
  });
}

describe("POST /v1/panel/auth/sign-in/username", () => {
  it("T1.9: gestor criado com o município loga no próprio município", async () => {
    const r = await enter(a, "gestor", MANAGER_PASSWORD);
    expect(r.status).toBe(200);
    expect(r.headers.getSetCookie().some((c) => c.startsWith("fila-painel"))).toBe(true);
  });

  it("T1.9: usuário de A não loga em B; cookie de A no Host de B não autentica", async () => {
    await orchestrator.createUserWithProfiles(a, "soema", sms());
    expect((await enter(b, "soema", "senha-forte-1")).status).toBe(401);
    const cookieA = await orchestrator.loginManager(a);
    const me = await orchestrator.panelRequest(b, "GET", "/v1/panel/me", { cookie: cookieA });
    expect(me.status).toBe(401);
  });

  it("login fora do formato → 400 no campo login (não no cpf, que é do paciente)", async () => {
    const r = await enter(a, "a b", "senha-forte-1");
    expect(r.status).toBe(400);
    expect(await r.json()).toMatchObject({ error: "invalid_input", fields: { login: [expect.any(String)] } });
  });

  it("senha errada → 401 invalid_credentials", async () => {
    const r = await enter(a, "gestor", "errada-123");
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ error: "invalid_credentials" });
  });

  it("T1.9: cadastro aberto pelo painel é recusado", async () => {
    const r = await orchestrator.panelRequest(a, "POST", "/v1/panel/auth/sign-up/email", {
      body: { email: "x@y.com", password: "senha-forte-1", name: "X", username: "xyz1" },
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await enter(a, "xyz1", "senha-forte-1")).status).toBe(401);
  });

  it("PD-24: origem do painel de B no Host de A não recebe CORS e o login é recusado", async () => {
    const r = await enter(a, "gestor", MANAGER_PASSWORD, panelOrigin(b));
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
    expect(r.status).toBe(403);
  });
});
