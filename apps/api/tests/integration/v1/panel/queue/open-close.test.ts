import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
});
afterAll(() => orchestrator.dropMunicipalities());

describe("abrir, ver a fila e encerrar a sessão (T3.4, T3.9)", () => {
  it("F1: a fila depende da atribuição — ACS e gestão SMS (sem ação da fila) levam 403; recepção vê", async () => {
    const acs = (
      await loggedInUser(c.slug, c.manager, "community_health_agent", occupation(c.unitId, "community_health_agent"))
    ).cookie;
    expect((await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, c.manager)).status).toBe(403);
    expect((await c.request("GET", `/v1/panel/units/${c.unitId}/today`, c.manager)).status).toBe(403);
    const reception = (await loggedInUser(c.slug, c.manager, "recep", occupation(c.unitId, "reception"))).cookie;
    expect((await c.request("GET", `/v1/panel/units/${c.unitId}/today`, acs)).status).toBe(403);
    expect((await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, acs)).status).toBe(403);
    expect((await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, reception)).status).toBe(200);
  });

  it("F1: quem opera vê as sessões de hoje e as estações; de outra unidade, 403", async () => {
    const r = await c.request("GET", `/v1/panel/units/${c.unitId}/today`, c.nurse);
    expect(r.status).toBe(200);
    expect(r.body.sessions.map((s: { id: string; service: string }) => [s.id, s.service])).toEqual([
      [c.sessionId, "Clínico"],
    ]);
    expect(r.body.stations.map((e: { name: string }) => e.name)).toEqual(["Sala 1", "Sala 2"]);
    const other = await orchestrator.createDirectUnit(c.slug, "UBS Norte");
    expect((await c.request("GET", `/v1/panel/units/${other}/today`, c.nurse)).status).toBe(403);
  });

  it("RN-FILA-01: abrir põe as confirmadas na fila, remotas e numeradas pela inscrição", async () => {
    await signUpPerson(c.slug, c.sessionId, "Ana Lima");
    await signUpPerson(c.slug, c.sessionId, "Bruno Reis");
    const without = await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.nurse);
    expect(without.status).toBe(403);
    const r = await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
    expect(r.status).toBe(200);
    expect(r.body.session.state).toBe("open");
    expect(
      r.body.items.map((i: { ticket: string; name: string; state: string }) => [i.ticket, i.name, i.state]),
    ).toEqual([
      ["C-001", "Ana Lima", "remote"],
      ["C-002", "Bruno Reis", "remote"],
    ]);
    expect((await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin)).status).toBe(409);
  });

  it("inscrição com a sessão aberta entra direto na fila com o próximo número", async () => {
    await signUpPerson(c.slug, c.sessionId, "Carla Dias");
    const queue = await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, c.nurse);
    expect(queue.status).toBe(200);
    expect(queue.body.items.at(-1)).toMatchObject({ ticket: "C-003", name: "Carla Dias", state: "remote" });
  });

  it("RN-SES-02: encerrar remaneja quem não teve a vez passada; sessão fica encerrada", async () => {
    const r = await c.request("POST", `/v1/panel/sessions/${c.sessionId}/close`, c.admin);
    expect(r.status).toBe(200);
    expect(r.body.session.state).toBe("closed");
    expect(new Set(r.body.items.map((i: { state: string }) => i.state))).toEqual(new Set(["reassigned"]));
    expect((await c.request("POST", `/v1/panel/sessions/${c.sessionId}/close`, c.admin)).status).toBe(409);
  });
});
