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

const request = (m: string, c: string, cookie: string, body?: unknown) =>
  orchestrator.panelRequest(slug, m, c, { cookie, ...(body !== undefined ? { body } : {}) });
const fresh = (login: string, assignments: object) => ({
  login,
  name: login,
  password: "senha-forte-1",
  ...assignments,
});

describe("equipe do painel", () => {
  it("T2.2: SMS cria recepção da unidade; ela loga e o eu mostra ocupação e papel", async () => {
    const r = await loggedInUser(slug, manager, "recep", occupation(unitId, "reception"));
    const me = await request("GET", "/v1/panel/me", r.cookie);
    expect(me.body).toMatchObject({
      unitLinks: [{ unitId, occupation: "reception" }],
      roles: [],
      profiles: [{ profile: "reception", unitId }],
    });
  });

  it("nome da equipe gravado com a primeira letra maiúscula (regra dos nomes)", async () => {
    const r = await request("POST", "/v1/panel/users", manager, {
      ...fresh("marianome", occupation(unitId, "reception")),
      name: "maria DA souza",
    });
    expect(r).toMatchObject({ status: 201, body: { name: "Maria da Souza" } });
  });

  it("escopo: função da unidade sem unidade, unidade inexistente e SMS com unidade → 400", async () => {
    const withoutUnit = { unitLinks: [], roles: [{ role: "unit_manager", unitId: null }] };
    expect((await request("POST", "/v1/panel/users", manager, fresh("semu", withoutUnit))).status).toBe(400);
    expect(
      (await request("POST", "/v1/panel/users", manager, fresh("inex", unitManagerRoles(crypto.randomUUID())))).status,
    ).toBe(400);
    const smsWithUnit = { unitLinks: [], roles: [{ role: "sms_management", unitId }] };
    expect((await request("POST", "/v1/panel/users", manager, fresh("smsu", smsWithUnit))).status).toBe(400);
    expect(
      (await request("POST", "/v1/panel/users", manager, fresh("vazio", { unitLinks: [], roles: [] }))).status,
    ).toBe(400);
  });

  it("RN-PERF-04: gerente cadastra a equipe da própria UBS, com a permissão agendar", async () => {
    const r = await request(
      "POST",
      "/v1/panel/users",
      managerCookie,
      fresh("tecnica", occupation(unitId, "nursing_technician", "scheduler")),
    );
    expect(r.status).toBe(201);
    expect(r.body.roles).toEqual([{ role: "scheduler", unitId }]);
  });

  it("RN-PERF-04: gerente não cadastra em outra UBS nem dá função de gestão", async () => {
    expect(
      (await request("POST", "/v1/panel/users", managerCookie, fresh("out", occupation(otherId, "physician")))).status,
    ).toBe(403);
    expect(
      (await request("POST", "/v1/panel/users", managerCookie, fresh("ger2", unitManagerRoles(unitId)))).status,
    ).toBe(403);
    expect((await request("POST", "/v1/panel/users", managerCookie, fresh("sms2", sms()))).status).toBe(403);
  });

  it("RN-PERF-04: quem não é SMS nem gerente não cadastra nem lista; gerente lista só a sua UBS", async () => {
    const nurse = await loggedInUser(slug, manager, "enf", occupation(unitId, "nurse"));
    expect(
      (
        await request(
          "POST",
          "/v1/panel/users",
          nurse.cookie,
          fresh("x1x", occupation(unitId, "community_health_agent")),
        )
      ).status,
    ).toBe(403);
    expect((await request("GET", "/v1/panel/users", nurse.cookie)).status).toBe(403);
    await loggedInUser(slug, manager, "norte", occupation(otherId, "physician"));
    const list = (await request("GET", "/v1/panel/users", managerCookie)).body.map((u: { login: string }) => u.login);
    expect(list).toContain("enf");
    expect(list).not.toContain("norte");
    expect(list).not.toContain("gestor");
  });

  it("RN-PERF-04: gerente não mexe em quem tem atribuição fora da UBS dele", async () => {
    const double = await loggedInUser(slug, manager, "dupla", {
      unitLinks: [
        { unitId, occupation: "physician" },
        { unitId: otherId, occupation: "physician" },
      ],
      roles: [],
    });
    const r = await request(
      "PUT",
      `/v1/panel/users/${double.id}/assignments`,
      managerCookie,
      occupation(unitId, "physician"),
    );
    expect(r.status).toBe(403);
  });

  it("login repetido → 409; último SMS não perde a função; com dois, um pode sair; troca auditada", async () => {
    const dup = await request("POST", "/v1/panel/users", manager, fresh("recep", occupation(unitId, "nurse")));
    expect(dup).toMatchObject({ status: 409, body: { error: "login_in_use" } });
    const me = (await request("GET", "/v1/panel/me", manager)).body;
    const last = await request("PUT", `/v1/panel/users/${me.id}/assignments`, manager, unitManagerRoles(unitId));
    expect(last).toMatchObject({ status: 409, body: { error: "last_manager" } });
    const other = await loggedInUser(slug, manager, "gestor2", sms());
    const swap = await request("PUT", `/v1/panel/users/${other.id}/assignments`, manager, unitManagerRoles(unitId));
    expect(swap).toMatchObject({ status: 200, body: { roles: [{ role: "unit_manager", unitId }] } });
    const rows = await orchestrator.municipalityDatabase(slug).select().from(audit).where(eq(audit.targetId, other.id));
    expect(rows).toHaveLength(2);
  });
});
