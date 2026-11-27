import { eq } from "drizzle-orm";
import { session } from "infra/database/municipal/schema/session";
import { sessionDay } from "infra/database/municipal/schema/session-day";
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
    // Sessão cancelada não muda mais de visibilidade (só planejada ou aberta).
    const visibility = await request("POST", `/v1/panel/sessions/${empty.id}/visibility`, admin, {
      visibility: "private",
      version: empty.version + 1,
    });
    expect(visibility).toMatchObject({ status: 409, body: { error: "forbidden_transition" } });
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

describe("horário em faixas (RN-SES-06)", () => {
  const lunch = [{ start: "2026-12-01T12:00:00.000Z", end: "2026-12-01T13:00:00.000Z" }];

  it("sem intervalo, a sessão é uma faixa só (como as antigas)", async () => {
    const r = await create(base());
    expect(r.body.breaks).toEqual([]);
  });

  it("cria e edita com o intervalo entre duas faixas; ao abrir, o vão é a pausa de todas as estações", async () => {
    const r = await create(base({ breaks: lunch }));
    expect(r).toMatchObject({ status: 201, body: { breaks: lunch } });
    const half = { start: "2026-12-01T12:30:00.000Z", end: "2026-12-01T13:30:00.000Z" };
    const later = [half];
    const edited = await request("PATCH", `/v1/panel/sessions/${r.body.id}`, admin, { breaks: later, version: 0 });
    expect(edited).toMatchObject({ status: 200, body: { breaks: later } });
    expect((await request("POST", `/v1/panel/sessions/${r.body.id}/open`, admin)).status).toBe(200);
    const [row] = await orchestrator
      .municipalityDatabase(slug)
      .select({ day: sessionDay.day })
      .from(sessionDay)
      .where(eq(sessionDay.sessionId, r.body.id));
    expect(row?.day.breaks).toEqual([{ start: Date.parse(half.start), end: Date.parse(half.end) }]);
    // Reenviar o mesmo intervalo com outra mudança não conta como mudar o horário.
    const db = orchestrator.municipalityDatabase(slug);
    const version = async () =>
      (await db.select({ v: session.version }).from(session).where(eq(session.id, r.body.id)))[0]?.v ?? -1;
    const same = await request("PATCH", `/v1/panel/sessions/${r.body.id}`, admin, {
      breaks: later,
      slots: 30,
      version: await version(),
    });
    expect(same).toMatchObject({ status: 200, body: { slots: 30 } });
    // Sem mandar o intervalo (o painel só muda as vagas), também não.
    const onlySlots = await request("PATCH", `/v1/panel/sessions/${r.body.id}`, admin, {
      slots: 31,
      version: await version(),
    });
    expect(onlySlots).toMatchObject({ status: 200, body: { slots: 31 } });
    // Aberta, o horário (e o intervalo) não muda mais.
    const again = await request("PATCH", `/v1/panel/sessions/${r.body.id}`, admin, {
      breaks: [],
      version: await version(),
    });
    expect(again).toMatchObject({ status: 409, body: { error: "forbidden_transition" } });
  });

  it("intervalo fora do horário ou sobreposto → 400 no campo breaks", async () => {
    const outside = await create(
      base({ breaks: [{ start: "2026-12-01T10:00:00.000Z", end: "2026-12-01T12:00:00.000Z" }] }),
    );
    expect(outside).toMatchObject({
      status: 400,
      body: { fields: { breaks: ["o intervalo fica dentro do horário da sessão"] } },
    });
    const overlap = await create(
      base({
        breaks: [
          { start: "2026-12-01T12:00:00.000Z", end: "2026-12-01T13:00:00.000Z" },
          { start: "2026-12-01T12:30:00.000Z", end: "2026-12-01T13:30:00.000Z" },
        ],
      }),
    );
    expect(overlap).toMatchObject({ status: 400, body: { fields: { breaks: ["as faixas não podem se sobrepor"] } } });
  });
});
