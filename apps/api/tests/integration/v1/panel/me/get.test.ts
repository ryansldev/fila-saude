import { userRole } from "infra/database/municipal/schema/staff";
import orchestrator from "tests/orchestrator";
import { unitManagerRoles } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: string;
let b: string;
let unitId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug: a } = await orchestrator.createMunicipality());
  ({ slug: b } = await orchestrator.createMunicipality());
  unitId = await orchestrator.createDirectUnit(a);
});
afterAll(() => orchestrator.dropMunicipalities());

describe("GET /v1/panel/me", () => {
  it("T1.9: eu devolve os perfis com escopo", async () => {
    const cookie = await orchestrator.loginManager(a);
    const r = await orchestrator.panelRequest(a, "GET", "/v1/panel/me", { cookie });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      login: "gestor",
      roles: [{ role: "sms_management", unitId: null }],
      profiles: [{ profile: "sms_management", unitId: null }],
    });
  });

  it("RN-PERF-01: enfermeira que também agenda tem os dois papéis", async () => {
    const u = await orchestrator.createUserWithProfiles(a, "dupla", {
      unitLinks: [{ unitId, occupation: "nurse" }],
      roles: [{ role: "scheduler", unitId }],
    });
    const cookie = await orchestrator.loginStaff(a, u.login, u.password);
    const r = await orchestrator.panelRequest(a, "GET", "/v1/panel/me", { cookie });
    expect(r.body.profiles).toHaveLength(2);
    expect(r.body.profiles.map((p: { profile: string }) => p.profile).sort()).toEqual(["nurse", "scheduler"]);
  });

  it("sem sessão → 401; cookie do paciente da central → 401", async () => {
    expect((await orchestrator.panelRequest(a, "GET", "/v1/panel/me")).status).toBe(401);
    const { cookie } = await orchestrator.loginPatient();
    expect((await orchestrator.panelRequest(a, "GET", "/v1/panel/me", { cookie })).status).toBe(401);
  });

  it("modelo: SMS com unidade e gerente sem unidade recusados pelo banco", async () => {
    const db = orchestrator.municipalityDatabase(a);
    const u = await orchestrator.createUserWithProfiles(a, "escopo", unitManagerRoles(unitId));
    await expect(db.insert(userRole).values({ userId: u.id, role: "sms_management", unitId })).rejects.toThrow();
    await expect(db.insert(userRole).values({ userId: u.id, role: "unit_manager", unitId: null })).rejects.toThrow();
  });

  it("perfil de A não aparece no eu de B", async () => {
    const cookieB = await orchestrator.loginManager(b);
    const r = await orchestrator.panelRequest(b, "GET", "/v1/panel/me", { cookie: cookieB });
    expect(r.body.profiles).toEqual([{ profile: "sms_management", unitId: null }]);
  });
});
