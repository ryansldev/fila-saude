import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let ana: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
let other: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
let regulatedId: string;
let referralId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  ana = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Ana Lista" }));
  other = await orchestrator.loginPatient();
  const service = async (name: string, prefix: string, mode: string) =>
    (
      await c.request("POST", `/v1/panel/units/${c.unitId}/services`, c.admin, {
        name,
        prefix,
        requiresTriage: false,
        mode,
        averageTimeMin: {},
      })
    ).body.id as string;
  regulatedId = await service("Cardiologia", "K", "regulated");
  referralId = await service("Raio-X", "R", "referral");
});
afterAll(() => orchestrator.dropMunicipalities());

async function app(method: string, path: string, cookie?: string, body?: unknown) {
  const r = await fetch(`${webserver.origin}${path}`, {
    method: method,
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : undefined };
}
const m = () => `/v1/municipalities/${c.slug}`;
const enter = (serviceId: string, cookie: string | undefined, body: unknown) =>
  app("POST", `${m()}/services/${serviceId}/entries`, cookie, body);
const me = { forWhom: { kind: "me" }, answers: ROUTINE };

describe("lista de espera pelo app (T5.1)", () => {
  it("I1: serviços da unidade com o modo de marcação, sem dado de paciente", async () => {
    const r = await app("GET", `${m()}/units/${c.unitId}/services`);
    expect(r.status).toBe(200);
    const byName = Object.fromEntries(r.body.map((s: { name: string; mode: string }) => [s.name, s.mode]));
    expect(byName).toEqual({ Cardiologia: "regulated", Clínico: "direct", "Raio-X": "referral" });
  });

  it("RN-LE-01/02/05: entra na lista para si e para outra pessoa; duplicada mostra a existente", async () => {
    expect((await enter(c.serviceId, undefined, me)).status).toBe(401);
    const r = await enter(c.serviceId, ana.cookie, me);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ state: "waiting", classification: { level: "routine" } });

    const dup = await enter(c.serviceId, ana.cookie, me);
    expect(dup).toMatchObject({ status: 409, body: { error: "duplicate", data: { entryId: r.body.entryId } } });

    const son = await enter(c.serviceId, ana.cookie, {
      forWhom: {
        kind: "other",
        relationship: "legal_guardian",
        declared: true,
        name: "Caio Lista",
        birthDate: "2018-03-03",
        cpf: null,
      },
      answers: ROUTINE,
    });
    expect(son.status).toBe(201);
    const withoutRelationship = await enter(c.serviceId, ana.cookie, {
      forWhom: { kind: "other", name: "Duda Lista", birthDate: "2019-05-05", cpf: null },
      answers: ROUTINE,
    });
    expect(withoutRelationship.status).toBe(400);

    const mine = (await app("GET", `${m()}/mine`, ana.cookie)).body;
    expect(
      mine.map((e: { person: string; state: string; session: unknown }) => [e.person, e.state, e.session]),
    ).toEqual([
      ["Ana Lista", "waiting", null],
      ["Caio Lista", "waiting", null],
    ]);
  });

  it("duplicada de outra conta não revela a entrada", async () => {
    const caio = {
      forWhom: {
        kind: "other",
        relationship: "legal_guardian",
        declared: true,
        name: "Caio Lista",
        birthDate: "2018-03-03",
        cpf: null,
      },
      answers: ROUTINE,
    };
    const dup = await enter(c.serviceId, other.cookie, caio);
    expect(dup.status).toBe(409);
    expect(dup.body.error).toBe("duplicate");
    expect(dup.body.data).toBeUndefined();
  });

  it("RN-ENC-05 e I2: regulado e requisição recusados; emergência não cria", async () => {
    expect((await enter(regulatedId, other.cookie, me)).body.error).toBe("regulated_service");
    expect((await enter(referralId, other.cookie, me)).body.error).toBe("referral_coming_soon");
    const emergency = await enter(c.serviceId, other.cookie, {
      forWhom: { kind: "me" },
      answers: { ...ROUTINE, alarms: ["chest_pain"] },
    });
    expect(emergency).toMatchObject({ status: 409, body: { error: "emergency" } });
  });

  it("RN-RISCO-03 / I9: refaz o questionário na lista; só a conta responsável", async () => {
    const id = (await app("GET", `${m()}/mine`, ana.cookie)).body.find(
      (e: { person: string }) => e.person === "Ana Lista",
    ).entryId;
    const severe = { ...ROUTINE, reason: "new", severity: "severe" };
    expect((await app("POST", `${m()}/entries/${id}/questionnaire`, other.cookie, { answers: severe })).status).toBe(
      404,
    );
    const r = await app("POST", `${m()}/entries/${id}/questionnaire`, ana.cookie, { answers: severe });
    expect(r).toMatchObject({ status: 200, body: { classification: { level: "urgent" } } });
    const emergency = await app("POST", `${m()}/entries/${id}/questionnaire`, ana.cookie, {
      answers: { ...ROUTINE, alarms: ["fainting"] },
    });
    expect(emergency).toMatchObject({ status: 409, body: { error: "emergency" } });
  });

  it("cancelar a entrada da lista libera o serviço para entrar de novo", async () => {
    const id = (await app("GET", `${m()}/mine`, ana.cookie)).body.find(
      (e: { person: string }) => e.person === "Caio Lista",
    ).entryId;
    expect((await app("POST", `${m()}/entries/${id}/cancel`, ana.cookie)).status).toBe(200);
    const caio = {
      forWhom: {
        kind: "other",
        relationship: "legal_guardian",
        declared: true,
        name: "Caio Lista",
        birthDate: "2018-03-03",
        cpf: null,
      },
      answers: ROUTINE,
    };
    expect((await enter(c.serviceId, ana.cookie, caio)).status).toBe(201);
  });
});
