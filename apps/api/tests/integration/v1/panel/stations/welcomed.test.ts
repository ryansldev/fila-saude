import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// RN-PERF-05 (Cofen 661/2021): o técnico de enfermagem acolhe na triagem; só o enfermeiro classifica.
let c: Awaited<ReturnType<typeof queueScenario>>;
let t1: string;
let technician: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario({ triage: true });
  t1 = c.t1 as string;
  const reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  technician = (await loggedInUser(c.slug, c.manager, "tecnico", occupation(c.unitId, "nursing_technician"))).cookie;
  const ids = [];
  for (const name of ["Ana", "Bruno"]) ids.push((await signUpPerson(c.slug, c.sessionId, name)).id);
  await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
  for (const entryId of ids)
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, { entryId, result: "matches" });
});
afterAll(() => orchestrator.dropMunicipalities());

const as = (cookie: string, command: string, body: unknown = {}) =>
  c.request("POST", `/v1/panel/stations/${t1}/${command}`, cookie, body);

describe("acolhimento pelo técnico na triagem", () => {
  it("o técnico não manda cor; finaliza o acolhimento e a pessoa volta para o enfermeiro", async () => {
    const called = await as(technician, "call");
    expect(called.body).toMatchObject({ called: { name: "Ana" }, classifies: false });
    await as(technician, "showed-up");
    expect((await as(technician, "finish", { confirmedRisk: "routine" })).status).toBe(403);
    expect((await as(technician, "finish")).status).toBe(200);
    // O técnico não chama de novo quem já acolheu: vem o Bruno.
    expect((await as(technician, "call")).body.called).toMatchObject({ name: "Bruno" });
  });

  it("o enfermeiro chama primeiro quem o técnico acolheu, e classifica", async () => {
    await as(technician, "showed-up");
    await as(technician, "finish");
    const nurse = await as(c.nurse, "call");
    expect(nurse.body).toMatchObject({ called: { name: "Ana" }, classifies: true });
  });
});
