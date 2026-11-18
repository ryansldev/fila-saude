import orchestrator from "tests/orchestrator";
import { UNIT } from "tests/panel";
import { queueScenario } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let otherId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  otherId = (await c.request("POST", "/v1/panel/units", c.manager, { ...UNIT, name: "UBS Norte" })).body.id;
});
afterAll(() => orchestrator.dropMunicipalities());

const summary = async () => {
  const r = await c.request("GET", "/v1/panel/units/today", c.manager);
  expect(r.status).toBe(200);
  return Object.fromEntries(
    r.body.map((x: { unitId: string; open: number; nextOpening: string | null }) => [x.unitId, x]),
  );
};

describe("resumo de hoje por unidade (troca de unidade no menu)", () => {
  it("planejada: quando abre; aberta: conta; unidade sem nada: zero e null", async () => {
    let r = await summary();
    // A sessão do cenário começou há 1 min e ainda não abriu.
    expect(r[c.unitId]).toMatchObject({ open: 0, nextOpening: expect.any(String) });
    expect(Date.parse(r[c.unitId].nextOpening)).toBeLessThan(Date.now());
    expect(r[otherId]).toMatchObject({ open: 0, nextOpening: null });
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
    r = await summary();
    expect(r[c.unitId]).toMatchObject({ open: 1, nextOpening: null });
  });

  it("sem login, 401", async () => {
    expect((await orchestrator.panelRequest(c.slug, "GET", "/v1/panel/units/today")).status).toBe(401);
  });
});
