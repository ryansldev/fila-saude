import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { beforeAll, describe, expect, it } from "vitest";

const signIn = (username: string, password: string) =>
  fetch(`${webserver.origin}/v1/auth/sign-in/username`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: webserver.origin },
    body: JSON.stringify({ username, password }),
  });

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});

describe("RN-ID-04: bloqueio temporário depois de senhas erradas seguidas", () => {
  it("5 erros seguidos bloqueiam o CPF, até com a senha certa; outro CPF segue entrando", async () => {
    const data = orchestrator.registrationData();
    expect((await orchestrator.registerPatient(data)).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await signIn(data.cpf, "senha-errada-1")).status).toBe(401);
    const blocked = await signIn(data.cpf, data.password);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: "login_locked" });

    const other = orchestrator.registrationData();
    await orchestrator.registerPatient(other);
    expect((await signIn(other.cpf, other.password)).status).toBe(200);
  });

  it("acertar a senha antes do limite zera a contagem", async () => {
    const data = orchestrator.registrationData();
    await orchestrator.registerPatient(data);
    for (let i = 0; i < 4; i++) await signIn(data.cpf, "senha-errada-1");
    expect((await signIn(data.cpf, data.password)).status).toBe(200);
    for (let i = 0; i < 4; i++) await signIn(data.cpf, "senha-errada-1");
    expect((await signIn(data.cpf, data.password)).status).toBe(200);
  });
});
