import { eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import { session } from "infra/database/municipal/schema/session";
import orchestrator from "tests/orchestrator";
import { loggedInUser, municipalityWithUnit, occupation, UNIT, unitManagerRoles } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let manager: string;
let unitId: string;
let admin: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, manager, unitId } = await municipalityWithUnit());
  admin = (await loggedInUser(slug, manager, "admin", unitManagerRoles(unitId))).cookie;
});
afterAll(() => orchestrator.dropMunicipalities());

const request = (m: string, c: string, cookie: string, body?: unknown) =>
  orchestrator.panelRequest(slug, m, c, { cookie, ...(body !== undefined ? { body } : {}) });
const service = (prefix: string, extra: object = {}) => ({
  name: `Serviço ${prefix}`,
  prefix,
  requiresTriage: false,
  mode: "direct",
  averageTimeMin: {},
  ...extra,
});
const create = (body: unknown, cookie = admin, u = unitId) =>
  request("POST", `/v1/panel/units/${u}/services`, cookie, body);

describe("serviços", () => {
  it("T2.3: admin cria serviço com triagem e tempos; padrões livre, 15 min", async () => {
    const r = await create(service("C", { requiresTriage: true, averageTimeMin: { triage: 5, care: 20 } }));
    expect(r).toMatchObject({
      status: 201,
      body: { prefix: "C", requiresTriage: true, averageTimeMin: { triage: 5, care: 20 } },
    });
    const p = await create(service("P"));
    expect(p.body).toMatchObject({ mode: "direct", averageTimeMin: { care: 15 } });
    const list = await request("GET", `/v1/panel/units/${unitId}/services`, admin);
    expect(list.body).toHaveLength(2);
  });

  it("prefixo repetido na unidade → 409; em outra unidade, aceito", async () => {
    expect(await create(service("C"))).toMatchObject({ status: 409, body: { error: "prefix_in_use" } });
    const u2 = await request("POST", "/v1/panel/units", manager, { ...UNIT, name: "UBS 2" });
    const admin2 = (await loggedInUser(slug, manager, "admin2", unitManagerRoles(u2.body.id))).cookie;
    expect((await create(service("C"), admin2, u2.body.id)).status).toBe(201);
    const s1 = (await request("GET", `/v1/panel/units/${unitId}/services`, admin)).body[0];
    expect((await request("PATCH", `/v1/panel/services/${s1.id}`, admin2, { name: "invasão" })).status).toBe(403);
  });

  it("RN-TRI-01: exige triagem muda com sessão planejada; com sessão aberta → 409 sessao_aberta", async () => {
    const s = (await create(service("T"))).body;
    const db = orchestrator.municipalityDatabase(slug);
    const [x] = await db
      .insert(session)
      .values({ serviceId: s.id, start: new Date(Date.now() + 864e5), end: new Date(Date.now() + 9e7) })
      .returning();
    expect((await request("PATCH", `/v1/panel/services/${s.id}`, admin, { requiresTriage: true })).status).toBe(200);
    await db
      .update(session)
      .set({ state: "open" })
      .where(eq(session.id, x?.id as string));
    expect(await request("PATCH", `/v1/panel/services/${s.id}`, admin, { requiresTriage: false })).toMatchObject({
      status: 409,
      body: { error: "session_open" },
    });
  });

  it("desligar triagem com estação de triagem ligada → 409", async () => {
    const s = (await create(service("E", { requiresTriage: true }))).body;
    await request("POST", `/v1/panel/units/${unitId}/stations`, admin, {
      name: "T1",
      stage: "triage",
      services: [s.id],
    });
    expect(await request("PATCH", `/v1/panel/services/${s.id}`, admin, { requiresTriage: false })).toMatchObject({
      status: 409,
      body: { error: "service_in_triage_station" },
    });
  });

  it("PD-42: modo com entradas ativas → 409 com a contagem; sem entradas, muda", async () => {
    const s = (await create(service("M"))).body;
    expect((await request("PATCH", `/v1/panel/services/${s.id}`, admin, { mode: "referral" })).status).toBe(200);
    const { joinWaitlist } = await import("infra/queue/entries");
    await request("PATCH", `/v1/panel/services/${s.id}`, admin, { mode: "direct" });
    await joinWaitlist(orchestrator.municipalityDatabase(slug), {
      serviceId: s.id,
      person: { name: "Ana", birthDate: "1990-01-01", cpf: null, patientId: null },
      guardianPatientId: null,
      answers: { alarms: [], reason: "follow_up", severity: null, conditions: [], groups: [] },
      now: Date.now(),
    });
    expect(await request("PATCH", `/v1/panel/services/${s.id}`, admin, { mode: "regulated" })).toMatchObject({
      status: 409,
      body: { error: "service_has_entries", data: { activeEntries: 1 } },
    });
  });

  it("recepção não configura → 403; INV-12: auditoria", async () => {
    const recep = (await loggedInUser(slug, manager, "recep", occupation(unitId, "reception"))).cookie;
    expect((await create(service("R"), recep)).status).toBe(403);
    const rows = await orchestrator
      .municipalityDatabase(slug)
      .select()
      .from(audit)
      .where(eq(audit.targetKind, "service"));
    expect(rows.length).toBeGreaterThan(0);
  });
});
