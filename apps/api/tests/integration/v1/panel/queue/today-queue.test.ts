import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation, UNIT } from "tests/panel";
import { queueScenario, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;
let dressingsId: string;
const entries: Record<string, string> = {};

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "recep", occupation(c.unitId, "reception"))).cookie;
  // Um segundo serviço com sessão hoje, para a fila da unidade inteira.
  const service = (
    await c.request("POST", `/v1/panel/units/${c.unitId}/services`, c.admin, {
      name: "Curativos",
      prefix: "V",
      requiresTriage: false,
      mode: "direct",
      averageTimeMin: {},
    })
  ).body.id as string;
  const room = (
    await c.request("POST", `/v1/panel/units/${c.unitId}/stations`, c.admin, {
      name: "Sala de procedimentos",
      stage: "care",
      services: [service],
    })
  ).body.id as string;
  const now = Date.now();
  dressingsId = (
    await c.request("POST", `/v1/panel/units/${c.unitId}/sessions`, c.admin, {
      serviceId: service,
      start: new Date(now - 60_000).toISOString(),
      end: new Date(now + 3 * 3600_000).toISOString(),
      slots: 10,
      visibility: "public",
      waivesPreRegistration: false,
      professional: null,
      stations: [room],
    })
  ).body.id as string;
  entries.ana = (await signUpPerson(c.slug, c.sessionId, "Ana Clínico")).id;
  entries.bia = (await signUpPerson(c.slug, c.sessionId, "Bia Clínico")).id;
  entries.caio = (await signUpPerson(c.slug, dressingsId, "caio  CURATIVO")).id;
  for (const s of [c.sessionId, dressingsId]) await c.request("POST", `/v1/panel/sessions/${s}/open`, c.admin);
});
afterAll(() => orchestrator.dropMunicipalities());

const todayQueue = (cookie: string) => c.request("GET", `/v1/panel/units/${c.unitId}/today-queue`, cookie);

describe("fila de hoje da unidade inteira (Fila do dia, caminho C)", () => {
  it("F1: só quem é da equipe da unidade", async () => {
    expect((await todayQueue(reception)).status).toBe(200);
    const other = (await c.request("POST", "/v1/panel/units", c.manager, { ...UNIT, name: "UBS Norte" })).body
      .id as string;
    const fromOutside = (await loggedInUser(c.slug, c.manager, "other", occupation(other, "reception"))).cookie;
    expect((await todayQueue(fromOutside)).status).toBe(403);
  });

  it("as sessões de hoje com as contagens, e as pessoas das duas com sessão e serviço", async () => {
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: entries.ana,
      result: "matches",
    });
    const r = await todayQueue(reception);
    const byService = Object.fromEntries(
      r.body.sessions.map((s: { service: string; counts: unknown }) => [s.service, s.counts]),
    );
    expect(byService).toEqual({
      Clínico: { inQueue: 2, inUnit: 1, onTheWay: 1, called: 0, attended: 0 },
      Curativos: { inQueue: 1, inUnit: 0, onTheWay: 1, called: 0, attended: 0 },
    });
    const caio = r.body.items.find((i: { name: string }) => i.name === "Caio Curativo");
    expect(caio).toMatchObject({ sessionId: dressingsId, service: "Curativos", since: null, station: null });
    const ana = r.body.items.find((i: { name: string }) => i.name === "Ana Clínico");
    expect(ana).toMatchObject({ sessionId: c.sessionId, service: "Clínico", state: "present" });
    expect(Date.parse(ana.since)).toBeLessThanOrEqual(Date.parse(r.body.now));
    expect(ana.document.cpf).toMatch(/^•••\.\d{3}\.\d{3}-••$/);
  });

  it("nome digitado em minúsculas aparece com maiúscula (regra dos nomes)", async () => {
    const r = await todayQueue(reception);
    expect(r.body.items.map((i: { name: string }) => i.name)).toContain("Caio Curativo");
  });

  it("RN-PERF-01: documento e quem inscreveu só para quem pode ver documentos (recepção, agendar)", async () => {
    const byReception = (await todayQueue(reception)).body.items.find(
      (i: { name: string }) => i.name === "Ana Clínico",
    );
    expect(byReception.document).toMatchObject({ birthDate: expect.any(String) });
    const byNurse = (await todayQueue(c.nurse)).body.items.find((i: { name: string }) => i.name === "Ana Clínico");
    expect(byNurse).toMatchObject({ document: null, guardian: null });
  });

  it("o chamado traz a hora da chamada e a sala", async () => {
    await c.request("POST", `/v1/panel/stations/${c.e1}/call`, c.nurse, {});
    const r = await todayQueue(reception);
    const ana = r.body.items.find((i: { name: string }) => i.name === "Ana Clínico");
    expect(ana).toMatchObject({ state: "called", station: "Sala 1" });
    expect(ana.since).toEqual(expect.any(String));
    expect(r.body.sessions.find((s: { service: string }) => s.service === "Clínico").counts.called).toBe(1);
  });
});
