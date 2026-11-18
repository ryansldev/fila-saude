import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let t1: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario({ triage: true });
  t1 = c.t1 as string;
  const reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  const ids: Record<string, string> = {};
  for (const name of ["Ana Souza", "Bruno Lima", "Carla Dias"])
    ids[name] = (await signUpPerson(c.slug, c.sessionId, name)).id;
  await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
  for (const n of ["Ana Souza", "Bruno Lima"]) {
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: ids[n],
      result: "matches",
    });
  }
});
afterAll(() => orchestrator.dropMunicipalities());

const op = (stationId: string) => c.request("GET", `/v1/panel/stations/${stationId}/operation`, c.nurse);
const cmd = (stationId: string, command: string, body: unknown = {}) =>
  c.request("POST", `/v1/panel/stations/${stationId}/${command}`, c.nurse, body);

describe("estação: compareceu e a fila à vista", () => {
  it("fila vazia: sem próximos, ninguém a caminho, sem mais antigo", async () => {
    const r = await op(c.e1);
    expect(r.body).toMatchObject({ upcoming: [], onTheWay: [], oldest: null });
  });

  it("a fila da triagem: primeiros nomes na ordem de chamada e quem está a caminho", async () => {
    const r = await op(t1);
    expect(r.body.upcoming.map((p: { name: string }) => p.name)).toEqual(["Ana", "Bruno"]);
    expect(r.body.upcoming[0]).toMatchObject({ ticket: expect.any(String), presentSince: expect.any(String) });
    expect(r.body.onTheWay).toEqual([{ ticket: expect.any(String), name: "Carla" }]);
    expect(r.body.oldest).toMatchObject({ presentSince: expect.any(String), targetTimeMin: 30 });
  });

  it("chamado sem compareceu: a triagem não classifica", async () => {
    const r = await cmd(t1, "call");
    expect(r.body.called).toMatchObject({ name: "Ana Souza", showedUpAt: null, priority: [] });
    expect(r.body.upcoming.map((p: { name: string }) => p.name)).toEqual(["Bruno"]);
    const f = await cmd(t1, "finish", { confirmedRisk: "urgent" });
    expect(f.status).toBe(409);
    expect(f.body).toMatchObject({ error: "no_show_up", message: "Marque Compareceu antes de classificar." });
  });

  it("compareceu, desfazer e de novo; depois disso não rechama", async () => {
    const a = await cmd(t1, "showed-up");
    expect(a.status).toBe(200);
    expect(a.body.called.showedUpAt).toEqual(expect.any(String));
    expect((await cmd(t1, "undo-showed-up")).body.called.showedUpAt).toBeNull();
    await cmd(t1, "showed-up");
    expect((await cmd(t1, "recall")).status).toBe(409);
  });

  it("com compareceu a triagem fecha; no atendimento o alvo é o da cor confirmada", async () => {
    expect((await cmd(t1, "finish", { confirmedRisk: "urgent" })).status).toBe(200);
    const r = await op(c.e1);
    expect(r.body.upcoming.map((p: { name: string }) => p.name)).toEqual(["Ana"]);
    expect(r.body.oldest).toMatchObject({ targetTimeMin: 60 });
  });
});
