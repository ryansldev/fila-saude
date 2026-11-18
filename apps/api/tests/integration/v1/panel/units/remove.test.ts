import { entry } from "infra/database/municipal/schema/entry";
import { joinWaitlist } from "infra/queue/entries";
import orchestrator from "tests/orchestrator";
import { loggedInUser, municipalityWithUnit, occupation, UNIT, unitManagerRoles } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let manager: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, manager } = await municipalityWithUnit());
});
afterAll(() => orchestrator.dropMunicipalities());

const request = (m: string, c: string, cookie: string, body?: unknown) =>
  orchestrator.panelRequest(slug, m, c, { cookie, ...(body !== undefined ? { body } : {}) });
const newUnit = async (name: string) =>
  (await request("POST", "/v1/panel/units", manager, { ...UNIT, name })).body.id as string;
const serviceAt = async (cookie: string, unitId: string) =>
  (
    await request("POST", `/v1/panel/units/${unitId}/services`, cookie, {
      name: "Odonto",
      prefix: "O",
      requiresTriage: false,
      mode: "direct",
      averageTimeMin: {},
    })
  ).body.id as string;

// Sessão precisa de estação que chame (revisão 2026-11-13).
const stationAt = async (cookie: string, unitId: string, serviceId: string) =>
  (
    await request("POST", `/v1/panel/units/${unitId}/stations`, cookie, {
      name: "C1",
      stage: "care",
      services: [serviceId],
    })
  ).body.id as string;

describe("DELETE /v1/panel/units/:id", () => {
  it("SMS remove unidade sem uso: some da lista e a equipe perde a atribuição nela", async () => {
    const id = await newUnit("UBS Vazia");
    const nurse = await loggedInUser(slug, manager, "enfvazia", occupation(id, "nurse"));
    expect((await request("DELETE", `/v1/panel/units/${id}`, manager)).status).toBe(204);
    const list = (await request("GET", "/v1/panel/units", manager)).body.map((u: { id: string }) => u.id);
    expect(list).not.toContain(id);
    expect((await request("GET", `/v1/panel/units/${id}`, manager)).status).toBe(404);
    expect((await request("GET", "/v1/panel/me", nurse.cookie)).body.unitLinks).toEqual([]);
  });

  it("gerente não remove unidade → 403", async () => {
    const id = await newUnit("UBS do Gerente");
    const g = await loggedInUser(slug, manager, "gerrem", unitManagerRoles(id));
    expect((await request("DELETE", `/v1/panel/units/${id}`, g.cookie)).status).toBe(403);
  });

  it("com sessão planejada → 409 unidade_com_sessoes", async () => {
    const id = await newUnit("UBS com Sessão");
    const g = await loggedInUser(slug, manager, "gersess", unitManagerRoles(id));
    const serviceId = await serviceAt(g.cookie, id);
    await request("POST", `/v1/panel/units/${id}/sessions`, g.cookie, {
      serviceId,
      start: "2026-12-01T11:00:00.000Z",
      end: "2026-12-01T15:00:00.000Z",
      slots: null,
      visibility: "private",
      waivesPreRegistration: false,
      professional: null,
      stations: [await stationAt(g.cookie, id, serviceId)],
    });
    expect(await request("DELETE", `/v1/panel/units/${id}`, manager)).toMatchObject({
      status: 409,
      body: { error: "unit_has_sessions" },
    });
  });

  it("com paciente na lista de espera → 409 unidade_com_entradas", async () => {
    const id = await newUnit("UBS com Lista");
    const g = await loggedInUser(slug, manager, "gerlista", unitManagerRoles(id));
    const serviceId = await serviceAt(g.cookie, id);
    const r = await joinWaitlist(orchestrator.municipalityDatabase(slug), {
      serviceId,
      person: { name: "Ana", birthDate: "1990-01-01", cpf: null, patientId: null },
      guardianPatientId: null,
      answers: { alarms: [], reason: "follow_up", severity: null, conditions: [], groups: [] },
      now: Date.now(),
    });
    expect(r.ok).toBe(true);
    expect(await request("DELETE", `/v1/panel/units/${id}`, manager)).toMatchObject({
      status: 409,
      body: { error: "unit_has_entries", data: { activeEntries: 1 } },
    });
    expect(entry).toBeDefined();
  });
});
