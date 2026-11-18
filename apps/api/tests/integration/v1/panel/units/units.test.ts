import { eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import orchestrator from "tests/orchestrator";
import { loggedInUser, municipalityWithUnit, UNIT, unitManagerRoles } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let manager: string;
let unitId: string;
let otherSlug: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, manager, unitId } = await municipalityWithUnit());
  ({ slug: otherSlug } = await orchestrator.createMunicipality());
});
afterAll(() => orchestrator.dropMunicipalities());

const request = (m: string, c: string, cookie: string, body?: unknown) =>
  orchestrator.panelRequest(slug, m, c, { cookie, ...(body !== undefined ? { body } : {}) });

describe("unidades", () => {
  it("T2.2: gestor cria unidade e ela aparece na lista; unidade de A não aparece em B", async () => {
    const list = await request("GET", "/v1/panel/units", manager);
    expect(list.status).toBe(200);
    expect(list.body.map((u: { id: string }) => u.id)).toContain(unitId);
    const managerB = await orchestrator.loginManager(otherSlug);
    const fromB = await orchestrator.panelRequest(otherSlug, "GET", "/v1/panel/units", { cookie: managerB });
    expect(fromB.body).toEqual([]);
  });

  it("T2.2: só o gestor cria ou edita; admin da unidade 1 lista só a unidade 1", async () => {
    const u2 = await request("POST", "/v1/panel/units", manager, { ...UNIT, name: "UBS 2" });
    const admin = await loggedInUser(slug, manager, "admin1", unitManagerRoles(unitId));
    expect((await request("POST", "/v1/panel/units", admin.cookie, UNIT)).status).toBe(403);
    expect((await request("PATCH", `/v1/panel/units/${unitId}`, admin.cookie, { name: "X" })).status).toBe(403);
    const list = await request("GET", "/v1/panel/units", admin.cookie);
    expect(list.body.map((u: { id: string }) => u.id)).toEqual([unitId]);
    expect(u2.status).toBe(201);
  });

  it("endereço estruturado e CNES voltam como foram gravados; edição troca o endereço", async () => {
    const r = await request("GET", `/v1/panel/units/${unitId}`, manager);
    expect(r.body.address).toEqual({ ...UNIT.address, postalCode: "01001000" });
    const fresh = {
      postalCode: "20040020",
      street: "Av. Rio Branco",
      number: "1",
      complement: "sala 2",
      neighborhood: "Centro",
    };
    const e = await request("PATCH", `/v1/panel/units/${unitId}`, manager, { address: fresh, cnes: "2077485" });
    expect(e.body).toMatchObject({ address: fresh, cnes: "2077485" });
  });

  it("fuso inválido → 400; K 0 → 400 no campo; K 1 aceito", async () => {
    const timeZone = await request("POST", "/v1/panel/units", manager, { ...UNIT, timeZone: "Brasil/Lua" });
    expect(timeZone).toMatchObject({ status: 400, body: { error: "invalid_input" } });
    expect(timeZone.body.fields.timeZone).toBeDefined();
    const k0 = await request("PATCH", `/v1/panel/units/${unitId}`, manager, { config: { windowK: 0 } });
    expect(k0.status).toBe(400);
    expect(k0.body.fields["config.windowK"]).toBeDefined();
    const k1 = await request("PATCH", `/v1/panel/units/${unitId}`, manager, { config: { windowK: 1 } });
    expect(k1).toMatchObject({ status: 200, body: { config: { windowK: 1 } } });
  });

  it("modelo: sem valor herda o padrão; com valor, origem unidade; null volta a herdar", async () => {
    await request("PATCH", `/v1/panel/units/${unitId}`, manager, { config: { toleranceMin: 7 } });
    let cfg = await request("GET", `/v1/panel/units/${unitId}/config`, manager);
    expect(cfg.body.origin.toleranceMin).toBe("unit");
    expect(cfg.body.values.toleranceMin).toBe(7);
    expect(cfg.body.origin.qrSeconds).toBe("default");
    await request("PATCH", `/v1/panel/units/${unitId}`, manager, { config: { toleranceMin: null } });
    cfg = await request("GET", `/v1/panel/units/${unitId}/config`, manager);
    expect(cfg.body.origin.toleranceMin).toBe("default");
  });

  it("INV-12: criar e editar auditados em nome do gestor", async () => {
    const rows = await orchestrator.municipalityDatabase(slug).select().from(audit).where(eq(audit.targetId, unitId));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(new Set(rows.map((l) => l.action))).toEqual(new Set(["create_units_and_rules"]));
  });
});
