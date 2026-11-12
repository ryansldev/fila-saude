import { origemDoPainel } from "infra/painel/origem";
import orchestrator, { SENHA_GESTOR } from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: string;
let b: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug: a } = await orchestrator.criarMunicipio());
  ({ slug: b } = await orchestrator.criarMunicipio());
});
afterAll(() => orchestrator.derrubarMunicipios());

function entrar(slug: string, login: string, senha: string, origem = origemDoPainel(slug)) {
  return fetch(`${orchestrator.origemDoTenant(slug)}/v1/painel/auth/sign-in/username`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: origem },
    body: JSON.stringify({ username: login, password: senha }),
  });
}

describe("POST /v1/painel/auth/sign-in/username", () => {
  it("T1.9: gestor criado com o município loga no próprio município", async () => {
    const r = await entrar(a, "gestor", SENHA_GESTOR);
    expect(r.status).toBe(200);
    expect(r.headers.getSetCookie().some((c) => c.startsWith("fila-painel"))).toBe(true);
  });

  it("T1.9: usuário de A não loga em B; cookie de A no Host de B não autentica", async () => {
    await orchestrator.criarUsuarioComPerfis(a, "soema", [{ perfil: "gestor", unidadeId: null }]);
    expect((await entrar(b, "soema", "senha-forte-1")).status).toBe(401);
    const cookieA = await orchestrator.loginGestor(a);
    const eu = await orchestrator.pedirPainel(b, "GET", "/v1/painel/eu", { cookie: cookieA });
    expect(eu.status).toBe(401);
  });

  it("senha errada → 401 credenciais_invalidas", async () => {
    const r = await entrar(a, "gestor", "errada-123");
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: "credenciais_invalidas" });
  });

  it("T1.9: cadastro aberto pelo painel é recusado", async () => {
    const r = await orchestrator.pedirPainel(a, "POST", "/v1/painel/auth/sign-up/email", {
      corpo: { email: "x@y.com", password: "senha-forte-1", name: "X", username: "xyz1" },
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await entrar(a, "xyz1", "senha-forte-1")).status).toBe(401);
  });

  it("PD-24: origem do painel de B no Host de A não recebe CORS e o login é recusado", async () => {
    const r = await entrar(a, "gestor", SENHA_GESTOR, origemDoPainel(b));
    expect(r.headers.get("access-control-allow-origin")).toBeNull();
    expect(r.status).toBe(403);
  });
});
