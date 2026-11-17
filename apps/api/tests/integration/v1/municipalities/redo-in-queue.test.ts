import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;
let ana: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
let entryId: string;

async function app(method: string, path: string, cookie?: string, body?: unknown) {
  const r = await fetch(`${webserver.origin}${path}`, {
    method: method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
const m = () => `/v1/municipalities/${c.slug}`;
const SEVERE = { ...ROUTINE, reason: "new" as const, severity: "severe" as const };
const redo = (answers: unknown) => app("POST", `${m()}/entries/${entryId}/questionnaire`, ana.cookie, { answers });
const itemOf = async () =>
  (await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, reception)).body.items.find(
    (i: { entryId: string }) => i.entryId === entryId,
  );

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  ana = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Ana Casa" }));
  const r = await app("POST", `${m()}/sessions/${c.sessionId}/sign-ups`, ana.cookie, {
    forWhom: { kind: "me" },
    answers: ROUTINE,
  });
  entryId = r.body.entryId;
  await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
});
afterAll(() => orchestrator.dropMunicipalities());

describe("refazer o questionário no dia (RN-PIORA-01, RN-RISCO-03)", () => {
  it("em casa, na fila do dia: refaz pelo app e o risco sobe na fila", async () => {
    const r = await redo(SEVERE);
    expect(r).toMatchObject({ status: 200, body: { classification: { level: "urgent" } } });
    expect(await itemOf()).toMatchObject({ state: "remote", risk: "urgent" });
  });

  it("na unidade: o app não muda o risco (vale 'meus sintomas pioraram' e o balcão)", async () => {
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, { entryId, result: "matches" });
    expect((await redo(ROUTINE)).status).toBe(409);
    expect(await itemOf()).toMatchObject({ state: "present", risk: "urgent" });
  });
});
