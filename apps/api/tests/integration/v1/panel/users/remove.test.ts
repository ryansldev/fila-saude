import { eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import orchestrator from "tests/orchestrator";
import { loggedInUser, municipalityWithUnit, occupation, sms, UNIT, unitManagerRoles } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let manager: string;
let unitId: string;
let otherId: string;
let managerCookie: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, manager, unitId } = await municipalityWithUnit());
  otherId = (
    await orchestrator.panelRequest(slug, "POST", "/v1/panel/units", {
      cookie: manager,
      body: { ...UNIT, name: "UBS Norte" },
    })
  ).body.id;
  managerCookie = (await loggedInUser(slug, manager, "gerente", unitManagerRoles(unitId))).cookie;
});
afterAll(() => orchestrator.dropMunicipalities());

const request = (m: string, c: string, cookie: string) => orchestrator.panelRequest(slug, m, c, { cookie });

describe("DELETE /v1/panel/users/:id", () => {
  it("gerente remove alguém da equipe: a pessoa sai da lista, a sessão dela cai e o login não entra mais", async () => {
    const tech = await loggedInUser(slug, manager, "tecrem", occupation(unitId, "nursing_technician"));
    expect((await request("DELETE", `/v1/panel/users/${tech.id}`, managerCookie)).status).toBe(204);
    const list = (await request("GET", "/v1/panel/users", manager)).body.map((u: { id: string }) => u.id);
    expect(list).not.toContain(tech.id);
    expect((await request("GET", "/v1/panel/me", tech.cookie)).status).toBe(401);
    await expect(orchestrator.loginStaff(slug, "tecrem", "senha-forte-1")).rejects.toThrow(/401/);
    const rows = await orchestrator.municipalityDatabase(slug).select().from(audit).where(eq(audit.targetId, tech.id));
    expect(rows.map((l) => l.data?.removed ?? null)).toContain(true);
  });

  it("RN-PERF-04: gerente não remove quem é de outra UBS nem a SMS; enfermeira não remove ninguém", async () => {
    const north = await loggedInUser(slug, manager, "norterem", occupation(otherId, "physician"));
    expect((await request("DELETE", `/v1/panel/users/${north.id}`, managerCookie)).status).toBe(403);
    const nurse = await loggedInUser(slug, manager, "enfrem", occupation(unitId, "nurse"));
    const acs = await loggedInUser(slug, manager, "acsrem", occupation(unitId, "community_health_agent"));
    expect((await request("DELETE", `/v1/panel/users/${acs.id}`, nurse.cookie)).status).toBe(403);
  });

  it("ninguém remove a si mesmo; com dois gestores da SMS, um remove o outro", async () => {
    const me = (await request("GET", "/v1/panel/me", manager)).body;
    expect(await request("DELETE", `/v1/panel/users/${me.id}`, manager)).toMatchObject({
      status: 409,
      body: { error: "remove_self" },
    });
    const other = await loggedInUser(slug, manager, "sms2rem", sms());
    expect(await request("DELETE", `/v1/panel/users/${other.id}`, managerCookie)).toMatchObject({ status: 403 });
    expect(await request("DELETE", `/v1/panel/users/${other.id}`, manager)).toMatchObject({ status: 204 });
  });

  it("login de quem foi removido pode ser cadastrado de novo? não: continua em uso", async () => {
    const x = await loggedInUser(slug, manager, "reuso", occupation(unitId, "community_health_agent"));
    await request("DELETE", `/v1/panel/users/${x.id}`, managerCookie);
    const r = await orchestrator.panelRequest(slug, "POST", "/v1/panel/users", {
      cookie: managerCookie,
      body: {
        login: "reuso",
        name: "Reuso",
        password: "senha-forte-1",
        ...occupation(unitId, "community_health_agent"),
      },
    });
    expect(r).toMatchObject({ status: 409, body: { error: "login_in_use" } });
  });
});
