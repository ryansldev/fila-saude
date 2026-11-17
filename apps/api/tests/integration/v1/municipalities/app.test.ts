import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let ana: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
let other: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
let carla: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
let privateId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  ana = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Ana Paciente" }));
  other = await orchestrator.loginPatient();
  carla = await orchestrator.loginPatient(orchestrator.registrationData({ name: "carla souza" }));
  const now = Date.now();
  privateId = (
    await c.request("POST", `/v1/panel/units/${c.unitId}/sessions`, c.admin, {
      serviceId: c.serviceId,
      start: new Date(now + 86400_000).toISOString(),
      end: new Date(now + 90000_000).toISOString(),
      slots: 5,
      visibility: "private",
      waivesPreRegistration: false,
      professional: null,
      stations: [c.e1],
    })
  ).body.id;
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
const signUp = (sessionId: string, cookie: string | undefined, body: unknown) =>
  app("POST", `${m()}/sessions/${sessionId}/sign-ups`, cookie, body);
const me = { forWhom: { kind: "me" }, answers: ROUTINE };

describe("app do paciente na API (T3.2, T3.3, T3.4)", () => {
  it("GET /v1/municipalities lista o município ativo", async () => {
    const r = await app("GET", "/v1/municipalities");
    expect(r.status).toBe(200);
    expect(r.body.map((x: { slug: string }) => x.slug)).toContain(c.slug);
  });

  it("RN-AG-01 (tela 5): unidades do município com endereço, coordenadas e quantos atendimentos abertos", async () => {
    const r = await app("GET", `${m()}/units`);
    expect(r.status).toBe(200);
    const u = r.body.find((x: { id: string }) => x.id === c.unitId);
    expect(u).toMatchObject({
      name: "UBS Centro",
      address: { street: expect.any(String), neighborhood: expect.any(String) },
      appointments: 1,
    });
    expect(u).toHaveProperty("lat");
    expect(u).toHaveProperty("lng");
  });

  it("T3.2: a agenda traz só sessões públicas, com vagas restantes e sem dado de paciente", async () => {
    const r = await app("GET", `${m()}/schedule`);
    expect(r.status).toBe(200);
    const ids = r.body.map((s: { id: string }) => s.id);
    expect(ids).toContain(c.sessionId);
    expect(ids).not.toContain(privateId);
    expect(r.body[0]).toMatchObject({
      service: { name: "Clínico" },
      unit: { name: "UBS Centro" },
      remainingSlots: 20,
    });
  });

  it("T3.3: inscrição exige conta; para mim e para outra pessoa; recusas com o código certo", async () => {
    expect((await signUp(c.sessionId, undefined, me)).status).toBe(401);
    const r = await signUp(c.sessionId, ana.cookie, me);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ state: "confirmed", classification: { level: "routine", support: false } });
    expect(await signUp(c.sessionId, ana.cookie, me)).toMatchObject({ status: 409, body: { error: "duplicate" } });
    const daughter = await signUp(c.sessionId, ana.cookie, {
      forWhom: {
        kind: "other",
        relationship: "legal_guardian",
        declared: true,
        name: "Bia Paciente",
        birthDate: "2015-02-02",
        cpf: null,
      },
      answers: ROUTINE,
    });
    expect(daughter.status).toBe(201);
    const mother = await signUp(c.sessionId, carla.cookie, {
      forWhom: {
        kind: "other",
        // Sem prioridade pela idade: não passa à frente da Ana, que o teste seguinte chama.
        name: "Lurdes Souza",
        birthDate: "1980-07-07",
        cpf: null,
        relationship: "family_or_friend",
        declared: true,
      },
      answers: ROUTINE,
    });
    expect(mother.status).toBe(201);
    // 2026-11-16: para outra pessoa, a relação e a declaração são obrigatórias.
    const withoutRelationship = { kind: "other", name: "Caio Paciente", birthDate: "2016-04-04", cpf: null };
    expect((await signUp(c.sessionId, ana.cookie, { forWhom: withoutRelationship, answers: ROUTINE })).status).toBe(
      400,
    );
    expect(
      (
        await signUp(c.sessionId, ana.cookie, {
          forWhom: { ...withoutRelationship, relationship: "caregiver", declared: false },
          answers: ROUTINE,
        })
      ).status,
    ).toBe(400);
    expect((await signUp(privateId, other.cookie, me)).body.error).toBe("private_session");
    const emergency = await signUp(c.sessionId, other.cookie, {
      forWhom: { kind: "me" },
      answers: { ...ROUTINE, alarms: ["chest_pain"] },
    });
    expect(emergency).toMatchObject({ status: 409, body: { error: "emergency" } });
    expect(
      (await app("GET", `${m()}/schedule`)).body.find((s: { id: string }) => s.id === c.sessionId).remainingSlots,
    ).toBe(17);
  });

  it("INV-06 / T3.4: 'minhas' mostra só as do paciente, com posição e depois a chamada", async () => {
    expect((await app("GET", `${m()}/mine`, other.cookie)).body).toEqual([]);
    let r = await app("GET", `${m()}/mine`, ana.cookie);
    expect(r.body.map((e: { person: string }) => e.person).sort()).toEqual(["Ana Paciente", "Bia Paciente"]);
    expect(r.body[0]).toMatchObject({ ticket: null, estimate: { kind: "awaiting_start" } });
    // O app precisa saber o serviço e se a inscrição é da própria conta, para não oferecer de novo (AD-032).
    const fromAna = r.body.find((e: { person: string }) => e.person === "Ana Paciente");
    const fromBia = r.body.find((e: { person: string }) => e.person === "Bia Paciente");
    expect(fromAna).toMatchObject({ serviceId: c.serviceId, forMe: true });
    expect(fromBia).toMatchObject({ serviceId: c.serviceId, forMe: false });

    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
    r = await app("GET", `${m()}/mine`, ana.cookie);
    const my = r.body.find((e: { person: string }) => e.person === "Ana Paciente");
    expect(my).toMatchObject({ ticket: "C-001", itemState: "remote", estimate: { kind: "come_now" } });

    const reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
    // A recepção vê quem inscreveu a Bia e a relação; a Ana se inscreveu sozinha.
    const queue = (await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, reception)).body;
    const byName = (name: string) => queue.items.find((i: { name: string }) => i.name === name);
    expect(byName("Bia Paciente").guardian).toEqual({ name: "Ana", relationship: "legal_guardian" });
    expect(byName("Ana Paciente").guardian).toBeNull();
    // O nome de quem inscreveu sai com a primeira letra maiúscula, mesmo digitado em minúsculas.
    expect(byName("Lurdes Souza").guardian).toEqual({ name: "Carla", relationship: "family_or_friend" });
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: my.entryId,
      result: "matches",
    });
    await c.request("POST", `/v1/panel/stations/${c.e1}/call`, c.nurse, {});
    r = await app("GET", `${m()}/mine`, ana.cookie);
    expect(r.body.find((e: { person: string }) => e.person === "Ana Paciente")).toMatchObject({
      itemState: "called",
      estimate: { kind: "called" },
      call: { station: "Sala 1" },
    });
  });
});
