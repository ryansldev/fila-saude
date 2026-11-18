import { eq } from "drizzle-orm";
import { station } from "infra/database/municipal/schema/station";
import orchestrator from "tests/orchestrator";
import { loggedInUser, municipalityWithUnit, UNIT, unitManagerRoles } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let manager: string;
let unitId: string;
let admin: string;
let withTriage: string;
let withoutTriage: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, manager, unitId } = await municipalityWithUnit());
  admin = (await loggedInUser(slug, manager, "admin", unitManagerRoles(unitId))).cookie;
  const s = (body: object) => request("POST", `/v1/panel/units/${unitId}/services`, admin, body);
  withTriage = (await s({ name: "Clínico", prefix: "C", requiresTriage: true, mode: "direct", averageTimeMin: {} }))
    .body.id;
  withoutTriage = (await s({ name: "Odonto", prefix: "O", requiresTriage: false, mode: "direct", averageTimeMin: {} }))
    .body.id;
});
afterAll(() => orchestrator.dropMunicipalities());

const request = (m: string, c: string, cookie: string, body?: unknown) =>
  orchestrator.panelRequest(slug, m, c, { cookie, ...(body !== undefined ? { body } : {}) });
const create = (body: unknown) => request("POST", `/v1/panel/units/${unitId}/stations`, admin, body);

describe("estações", () => {
  it("RN-EST-01 / RN-TRI-02: estação ligada a etapa e serviços", async () => {
    const r = await create({ name: "Consultório 1", stage: "care", services: [withTriage, withoutTriage] });
    expect(r).toMatchObject({ status: 201, body: { stage: "care", open: false } });
    expect(r.body.services.sort()).toEqual([withTriage, withoutTriage].sort());
    expect((await create({ name: "Triagem 1", stage: "triage", services: [withTriage] })).status).toBe(201);
  });

  it("triagem com serviço sem triagem → 400; serviço de outra unidade → 400", async () => {
    expect((await create({ name: "T2", stage: "triage", services: [withoutTriage] })).status).toBe(400);
    const u2 = await request("POST", "/v1/panel/units", manager, { ...UNIT, name: "UBS 2" });
    const adm2 = (await loggedInUser(slug, manager, "adm2", unitManagerRoles(u2.body.id))).cookie;
    const outside = (
      await request("POST", `/v1/panel/units/${u2.body.id}/services`, adm2, {
        name: "X",
        prefix: "X",
        requiresTriage: false,
        mode: "direct",
        averageTimeMin: {},
      })
    ).body.id;
    expect((await create({ name: "C9", stage: "care", services: [outside] })).status).toBe(400);
  });

  it("edita nome e serviços; estação aberta não é arquivada; fechada some da lista", async () => {
    const e = (await create({ name: "C3", stage: "care", services: [withoutTriage] })).body;
    expect((await request("PATCH", `/v1/panel/stations/${e.id}`, admin, { name: "Consultório 3" })).body.name).toBe(
      "Consultório 3",
    );
    await orchestrator.municipalityDatabase(slug).update(station).set({ open: true }).where(eq(station.id, e.id));
    expect(await request("DELETE", `/v1/panel/stations/${e.id}`, admin)).toMatchObject({
      status: 409,
      body: { error: "station_busy" },
    });
    await orchestrator.municipalityDatabase(slug).update(station).set({ open: false }).where(eq(station.id, e.id));
    expect((await request("DELETE", `/v1/panel/stations/${e.id}`, admin)).status).toBe(204);
    const list = await request("GET", `/v1/panel/units/${unitId}/stations`, admin);
    expect(list.body.map((x: { id: string }) => x.id)).not.toContain(e.id);
  });
  it("não tira da estação um serviço que tem sessão planejada ou aberta com ela (ficaria sem quem chame)", async () => {
    const st = (await create({ name: "Consultório 9", stage: "care", services: [withTriage, withoutTriage] })).body.id;
    const start = Date.now() + 2 * 86400_000;
    const s = await request("POST", `/v1/panel/units/${unitId}/sessions`, admin, {
      serviceId: withoutTriage,
      start: new Date(start).toISOString(),
      end: new Date(start + 3600_000).toISOString(),
      slots: 5,
      visibility: "public",
      waivesPreRegistration: false,
      professional: null,
      stations: [st],
    });
    expect(s.status).toBe(201);
    const edit = (services: string[]) => request("PATCH", `/v1/panel/stations/${st}`, admin, { services });
    expect(await edit([withTriage])).toMatchObject({ status: 409, body: { error: "station_in_use" } });
    // Tirar outro serviço (sem sessão com a estação) continua valendo.
    expect((await edit([withoutTriage])).status).toBe(200);
  });
});
