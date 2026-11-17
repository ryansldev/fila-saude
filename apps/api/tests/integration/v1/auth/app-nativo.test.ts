import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.createMunicipality());
});
afterAll(() => orchestrator.dropMunicipalities());

const json = { "content-type": "application/json" };

// O app nativo (Expo) não manda Origin nem guarda cookie: recebe um token e o devolve em Authorization.
describe("app nativo: login por token (PD-34)", () => {
  it("cadastro e login sem Origin devolvem set-auth-token; o token autentica nas rotas do município", async () => {
    const data = orchestrator.registrationData();
    const registration = await fetch(`${webserver.origin}/v1/auth/sign-up/email`, {
      method: "POST",
      headers: json,
      body: JSON.stringify(data),
    });
    expect(registration.status).toBe(200);
    expect(registration.headers.get("set-auth-token")).toBeTruthy();

    const login = await fetch(`${webserver.origin}/v1/auth/sign-in/username`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({ username: data.cpf, password: data.password }),
    });
    expect(login.status).toBe(200);
    const token = login.headers.get("set-auth-token");
    expect(token).toBeTruthy();

    const mine = await fetch(`${webserver.origin}/v1/municipalities/${slug}/mine`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(mine.status).toBe(200);
    expect(await mine.json()).toEqual([]);

    const bad = await fetch(`${webserver.origin}/v1/municipalities/${slug}/mine`, {
      headers: { authorization: "Bearer lixo" },
    });
    expect(bad.status).toBe(401);
  });
});
