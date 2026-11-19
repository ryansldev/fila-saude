import orchestrator from "tests/orchestrator";
import { queueScenario } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
});
afterAll(() => orchestrator.dropMunicipalities());

const panel = (method: string, path: string, cookie?: string, body?: unknown) =>
  orchestrator.panelRequest(c.slug, method, path, {
    ...(cookie ? { cookie } : {}),
    ...(body !== undefined ? { body } : {}),
  });

// DOC2: no painel, o login é conferido antes do schema (corpo, query e caminho).
describe("rotas do painel com schema (DOC2)", () => {
  it("sem login: 401 not_authenticated, mesmo com corpo inválido ou id malformado", async () => {
    for (const [method, path, body] of [
      ["POST", "/v1/panel/units", { wrong: true }],
      ["PATCH", `/v1/panel/sessions/${c.sessionId}`, { slots: "x" }],
      ["POST", `/v1/panel/stations/${c.e1}/call`, { refer: "x" }],
      ["GET", "/v1/panel/units/abc", undefined],
      ["GET", `/v1/panel/units/${c.unitId}/sessions?from=x`, undefined],
    ] as const) {
      const r = await panel(method, path, undefined, body);
      expect([method, path, r.status, r.body?.error]).toEqual([method, path, 401, "not_authenticated"]);
    }
  });

  it("com login: id malformado 404 not_found; corpo e query inválidos 400 com os campos", async () => {
    const bad = await panel("GET", "/v1/panel/units/abc", c.admin);
    expect([bad.status, bad.body.error]).toEqual([404, "not_found"]);
    const body = await panel("POST", "/v1/panel/units", c.admin, {});
    expect(body.status).toBe(400);
    expect(Object.keys(body.body.fields ?? {})).toContain("name");
    const query = await panel("GET", `/v1/panel/units/${c.unitId}/sessions?from=x`, c.admin);
    expect(query.status).toBe(400);
    expect(Object.keys(query.body.fields ?? {}).sort()).toEqual(["from", "until"]);
  });

  it("comando da estação sem corpo continua aceito", async () => {
    const r = await panel("POST", `/v1/panel/stations/${c.e1}/recall`, c.nurse);
    expect(r.status).not.toBe(400);
  });
});
