import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { CAPTCHA_OK, queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  await orchestrator.waitForAllServices();
});
afterAll(() => orchestrator.dropMunicipalities());

async function signUp(url: string, cookie: string, headers: Record<string, string>) {
  const r = await fetch(url, {
    method: "POST",
    headers: { cookie, "content-type": "application/json", ...headers },
    body: JSON.stringify({ forWhom: { kind: "me" }, answers: ROUTINE }),
  });
  return { status: r.status, body: await r.json() };
}

describe("RN-ID-07 / AD-062: captcha na inscrição em sessão pública", () => {
  it("sem captcha ou com um que não passa, recusa; com o captcha resolvido, inscreve", async () => {
    const c = await queueScenario();
    const ana = await orchestrator.loginPatient();
    const url = `${webserver.origin}/v1/municipalities/${c.slug}/sessions/${c.sessionId}/sign-ups`;
    const none = await signUp(url, ana.cookie, {});
    expect(none.status).toBe(400);
    expect(none.body).toMatchObject({ error: "captcha_required" });
    expect((await signUp(url, ana.cookie, { "x-captcha-token": "inventado" })).body).toMatchObject({
      error: "captcha_failed",
    });
    expect((await signUp(url, ana.cookie, CAPTCHA_OK)).status).toBe(201);
  });
});
