import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.criarMunicipio());
});
afterAll(() => orchestrator.derrubarMunicipios());

const json = { "content-type": "application/json" };

// O app nativo (Expo) não manda Origin nem guarda cookie: recebe um token e o devolve em Authorization.
describe("app nativo: login por token (PD-34)", () => {
  it("cadastro e login sem Origin devolvem set-auth-token; o token autentica nas rotas do município", async () => {
    const dados = orchestrator.dadosDeCadastro();
    const cadastro = await fetch(`${webserver.origin}/v1/auth/sign-up/email`, {
      method: "POST",
      headers: json,
      body: JSON.stringify(dados),
    });
    expect(cadastro.status).toBe(200);
    expect(cadastro.headers.get("set-auth-token")).toBeTruthy();

    const login = await fetch(`${webserver.origin}/v1/auth/sign-in/username`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ username: dados.cpf, password: dados.senha }),
    });
    expect(login.status).toBe(200);
    const token = login.headers.get("set-auth-token");
    expect(token).toBeTruthy();

    const minhas = await fetch(`${webserver.origin}/v1/municipios/${slug}/minhas`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(minhas.status).toBe(200);
    expect(await minhas.json()).toEqual([]);

    const ruim = await fetch(`${webserver.origin}/v1/municipios/${slug}/minhas`, {
      headers: { authorization: "Bearer lixo" },
    });
    expect(ruim.status).toBe(401);
  });
});
