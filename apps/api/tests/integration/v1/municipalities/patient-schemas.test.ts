import { randomUUID } from "node:crypto";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { queueScenario } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let ana: Awaited<ReturnType<typeof orchestrator.loginPatient>>;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  ana = await orchestrator.loginPatient();
});
afterAll(() => orchestrator.dropMunicipalities());

async function call(method: string, path: string, cookie?: string, body?: unknown) {
  const r = await fetch(`${webserver.origin}${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return { status: r.status, body: (await r.json()) as { error?: string; fields?: Record<string, string[]> } };
}
const m = () => `/v1/municipalities/${c.slug}`;

// DOC2: com o schema no Fastify, o login continua sendo conferido antes do corpo e do caminho.
describe("rotas do paciente com schema (DOC2)", () => {
  it("sem login e com corpo inválido: 401 not_authenticated", async () => {
    for (const path of [
      `${m()}/sessions/${c.sessionId}/sign-ups`,
      `${m()}/sessions/${c.sessionId}/sign-ups/check`,
      `${m()}/services/${c.serviceId}/entries`,
      `${m()}/entries/${randomUUID()}/questionnaire`,
      `${m()}/check-in`,
    ]) {
      const r = await call("POST", path, undefined, { wrong: true });
      expect([path, r.status, r.body.error]).toEqual([path, 401, "not_authenticated"]);
    }
    for (const method of ["PUT", "DELETE"]) {
      const push = await call(method, "/v1/patient/push", undefined, { wrong: true });
      expect([method, push.status, push.body.error]).toEqual([method, 401, "not_authenticated"]);
    }
    const mine = await fetch(`${webserver.origin}${m()}/mine`);
    expect(mine.status).toBe(401);
  });

  it("sem login e com id malformado: 401, não 404", async () => {
    const r = await call("POST", `${m()}/entries/abc/cancel`);
    expect(r.status).toBe(401);
  });

  it("município desconhecido vem antes do login: 404 unknown_municipality", async () => {
    const r = await call("POST", "/v1/municipalities/nao-existe/check-in", undefined, { wrong: true });
    expect([r.status, r.body.error]).toEqual([404, "unknown_municipality"]);
  });

  it("com login: id malformado 404 not_found; corpo inválido 400 com os campos", async () => {
    const bad = await call("POST", `${m()}/entries/abc/confirm`, ana.cookie);
    expect([bad.status, bad.body.error]).toEqual([404, "not_found"]);
    const invalid = await call("POST", `${m()}/sessions/${c.sessionId}/sign-ups`, ana.cookie, {});
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.fields ?? {}).sort()).toEqual(["answers", "forWhom"]);
  });
});
