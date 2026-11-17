import { eq } from "drizzle-orm";
import { session } from "infra/database/municipal/schema/session";
import orchestrator from "tests/orchestrator";
import { loggedInUser, municipalityWithUnit, unitManagerRoles } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let unitId: string;
let admin: string;
let serviceId: string;
let regulatedId: string;
let stationId: string;
let otherStation: string;

const answers = { alarms: [], reason: "follow_up", severity: null, conditions: [], groups: [] } as const;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  let manager: string;
  ({ slug, manager, unitId } = await municipalityWithUnit());
  admin = (await loggedInUser(slug, manager, "admin", unitManagerRoles(unitId))).cookie;
  const s = (body: object) =>
    request("POST", `/v1/panel/units/${unitId}/services`, admin, {
      requiresTriage: false,
      mode: "direct",
      averageTimeMin: {},
      ...body,
    });
  serviceId = (await s({ name: "Odonto", prefix: "O" })).body.id;
  regulatedId = (await s({ name: "Cardio", prefix: "K", mode: "regulated" })).body.id;
  const e = (name: string, services: string[]) =>
    request("POST", `/v1/panel/units/${unitId}/stations`, admin, { name, stage: "care", services });
  stationId = (await e("C1", [serviceId])).body.id;
  otherStation = (await e("C2", [regulatedId])).body.id;
});
afterAll(() => orchestrator.dropMunicipalities());

const request = (m: string, c: string, cookie: string, body?: unknown) =>
  orchestrator.panelRequest(slug, m, c, { cookie, ...(body !== undefined ? { body } : {}) });
const base = (extra: object = {}) => ({
  serviceId,
  start: "2026-12-01T11:00:00.000Z",
  end: "2026-12-01T15:00:00.000Z",
  slots: 20,
  visibility: "public",
  waivesPreRegistration: false,
  professional: "Dra. Helena",
  stations: [stationId],
  ...extra,
});
const create = (body: unknown) => request("POST", `/v1/panel/units/${unitId}/sessions`, admin, body);

describe("sessões avulsas", () => {
  it("T2.5: admin cria sessão avulsa pública com vagas e estações; lista por intervalo", async () => {
    const r = await create(base());
    expect(r).toMatchObject({
      status: 201,
      body: { state: "planned", slots: 20, taken: 0, version: 0, stations: [stationId] },
    });
    const list = await request(
      "GET",
      `/v1/panel/units/${unitId}/sessions?from=2026-12-01T00:00:00Z&until=2026-12-02T00:00:00Z`,
      admin,
    );
    expect(list.body.map((s: { id: string }) => s.id)).toContain(r.body.id);
    const empty = await request(
      "GET",
      `/v1/panel/units/${unitId}/sessions?from=2026-12-02T00:00:00Z&until=2026-12-03T00:00:00Z`,
      admin,
    );
    expect(empty.body).toEqual([]);
  });

  it("vagas 0 → 400; 1 aceito; AD-016 dispensa em privada → 400; estação que não atende → 400", async () => {
    expect((await create(base({ slots: 0 }))).status).toBe(400);
    expect((await create(base({ slots: 1 }))).status).toBe(201);
    expect((await create(base({ visibility: "private", waivesPreRegistration: true }))).status).toBe(400);
    expect((await create(base({ stations: [otherStation] }))).status).toBe(400);
  });

  it("pública em serviço regulado → 409 servico_regulado", async () => {
    expect(await create(base({ serviceId: regulatedId, stations: [otherStation] }))).toMatchObject({
      status: 409,
      body: { error: "regulated_service" },
    });
  });

  it("vagas = ocupadas aceito; ocupadas − 1 → 409; versao velha → 409; aberta não muda horário", async () => {
    const s = (await create(base())).body;
    const db = orchestrator.municipalityDatabase(slug);
    await db.update(session).set({ taken: 5 }).where(eq(session.id, s.id));
    const ok = await request("PATCH", `/v1/panel/sessions/${s.id}`, admin, { slots: 5, version: 0 });
    expect(ok).toMatchObject({ status: 200, body: { slots: 5, version: 1 } });
    expect(await request("PATCH", `/v1/panel/sessions/${s.id}`, admin, { slots: 4, version: 1 })).toMatchObject({
      status: 409,
      body: { error: "slots_below_taken" },
    });
    expect(await request("PATCH", `/v1/panel/sessions/${s.id}`, admin, { slots: 9, version: 0 })).toMatchObject({
      status: 409,
      body: { error: "outdated_version" },
    });
    await db.update(session).set({ state: "open" }).where(eq(session.id, s.id));
    expect(
      await request("PATCH", `/v1/panel/sessions/${s.id}`, admin, { start: "2026-12-01T12:00:00.000Z", version: 1 }),
    ).toMatchObject({ status: 409, body: { error: "forbidden_transition" } });
  });

  it("RN-PUB-03: pública vira privada e perde a dispensa", async () => {
    const s = (await create(base({ waivesPreRegistration: true }))).body;
    const r = await request("POST", `/v1/panel/sessions/${s.id}/visibility`, admin, {
      visibility: "private",
      version: 0,
    });
    expect(r).toMatchObject({ status: 200, body: { visibility: "private", waivesPreRegistration: false } });
  });

  it("cancelar planejada vazia; com entrada → 409 sessao_com_pacientes", async () => {
    const empty = (await create(base())).body;
    expect(await request("POST", `/v1/panel/sessions/${empty.id}/cancel`, admin, {})).toMatchObject({
      status: 200,
      body: { state: "cancelled" },
    });
    const full = (await create(base())).body;
    const { joinWaitlist } = await import("infra/queue/entries");
    const { entry } = await import("infra/database/municipal/schema/entry");
    const r = await joinWaitlist(orchestrator.municipalityDatabase(slug), {
      serviceId,
      person: { name: "Bia", birthDate: "1990-01-01", cpf: null, patientId: null },
      guardianPatientId: null,
      answers: { ...answers, alarms: [], conditions: [], groups: [] },
      now: Date.now(),
    });
    if (!r.ok) throw new Error(r.error);
    await orchestrator
      .municipalityDatabase(slug)
      .update(entry)
      .set({ sessionId: full.id, state: "allocated" })
      .where(eq(entry.id, r.state.id));
    expect(await request("POST", `/v1/panel/sessions/${full.id}/cancel`, admin, {})).toMatchObject({
      status: 409,
      body: { error: "session_has_patients" },
    });
  });
});
