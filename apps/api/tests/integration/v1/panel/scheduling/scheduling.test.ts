import type { SessionDay } from "@fila-saude/domain";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import { joinWaitlist } from "infra/queue/entries";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let schedule: string;
let agenda2: string;
let privateId: string;
let ana: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
const ids: Record<string, string> = {};

const DAY = 86400_000;
const SEVERE = { ...ROUTINE, reason: "new" as const, severity: "severe" as const };
const SELF_HARM = { ...ROUTINE, alarms: ["self_harm" as const] };

async function withoutAccount(name: string, answers = ROUTINE, birthDate = "1990-05-05") {
  const r = await joinWaitlist(orchestrator.municipalityDatabase(c.slug), {
    serviceId: c.serviceId,
    person: { name, birthDate: birthDate, cpf: orchestrator.generateCpf(), patientId: null },
    guardianPatientId: null,
    answers,
    now: Date.now() - 10 * DAY,
  });
  if (!r.ok) throw new Error(r.error);
  return r.state.id;
}

async function privateOne(slots: number, inDays = 2) {
  const start = Date.now() + inDays * DAY;
  const r = await c.request("POST", `/v1/panel/units/${c.unitId}/sessions`, c.admin, {
    serviceId: c.serviceId,
    start: new Date(start).toISOString(),
    end: new Date(start + 4 * 3600_000).toISOString(),
    slots,
    visibility: "private",
    waivesPreRegistration: false,
    professional: null,
    stations: [c.e1],
  });
  return r.body.id as string;
}

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  schedule = (await loggedInUser(c.slug, c.manager, "schedule", occupation(c.unitId, "reception", "scheduler"))).cookie;
  agenda2 = (await loggedInUser(c.slug, c.manager, "agenda2", occupation(c.unitId, "reception", "scheduler"))).cookie;
  privateId = await privateOne(3);
  ids.routine = await withoutAccount("Rosa Rotina");
  ids.urgent = await withoutAccount("Ulisses Urgente", SEVERE);
  ids.support = await withoutAccount("Aline Apoio", SELF_HARM);
  ana = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Ana Agenda" }));
  const r = await fetch(`${webserver.origin}/v1/municipalities/${c.slug}/services/${c.serviceId}/entries`, {
    method: "POST",
    headers: { cookie: ana.cookie, "content-type": "application/json" },
    body: JSON.stringify({ forWhom: { kind: "me" }, answers: ROUTINE }),
  });
  ids.ana = ((await r.json()) as { entryId: string }).entryId;
});
afterAll(() => orchestrator.dropMunicipalities());

const allocation = (cookie: string, sessionId = privateId) =>
  c.request("GET", `/v1/panel/sessions/${sessionId}/allocation`, cookie);
const allocate = (cookie: string, entryId: string, sessionId = privateId) =>
  c.request("POST", `/v1/panel/sessions/${sessionId}/allocate`, cookie, { entryId });
const answer = (cookie: string, entryId: string, answer: string) =>
  c.request("POST", `/v1/panel/entries/${entryId}/answer`, cookie, { answer });

describe("agendador (T5.3, T5.4)", () => {
  it("RN-PERF-02: só quem agenda vê a alocação", async () => {
    expect((await allocation(c.nurse)).status).toBe(403);
    expect((await allocation(schedule)).status).toBe(200);
  });

  it("RN-AL-01/02/03, I4: sugestão com motivos, urgente no topo com alerta, autolesão e faltas", async () => {
    const r = await allocation(schedule);
    expect(r.body.session).toMatchObject({ id: privateId, slots: 3, taken: 0, canAllocate: true });
    expect(r.body.allocated).toEqual([]);
    const names = r.body.suggestion.map((s: { name: string }) => s.name);
    expect(names.slice(0, 2).sort()).toEqual(["Aline Apoio", "Ulisses Urgente"]);
    const urgent = r.body.suggestion.find((s: { name: string }) => s.name === "Ulisses Urgente");
    expect(urgent).toMatchObject({
      alert: true,
      selfHarm: false,
      noShows: 0,
      noShowAlert: false,
      risk: { level: "urgent", confirmed: false, rule: "Problema novo forte" },
    });
    // O risco vem em `risco`; os motivos não o repetem (design system, Agendamento A).
    expect(urgent.reasons[0]).not.toBe("urgente sugerido");
    expect(urgent.reasons.at(-1)).toMatch(/^espera há \d+ dias$/);
    expect(urgent.withoutApp).toBe(true);
    expect(r.body.suggestion.find((s: { name: string }) => s.name === "Ana Agenda").withoutApp).toBe(false);
    expect(r.body.suggestion.find((s: { name: string }) => s.name === "Aline Apoio").selfHarm).toBe(true);
  });

  it("RN-FALTA-03: as faltas dos encerramentos da janela contam na sugestão", async () => {
    const closed = await privateOne(1, 5);
    const day = { closing: { at: Date.now() - DAY, noShows: [`${closed}/${ids.routine}`], origin: "private" } };
    await orchestrator
      .municipalityDatabase(c.slug)
      .insert(sessionDay)
      .values({ sessionId: closed, day: day as unknown as SessionDay });
    const r = await allocation(schedule);
    expect(r.body.suggestion.find((s: { name: string }) => s.name === "Rosa Rotina")).toMatchObject({ noShows: 1 });
  });

  it("RN-AL-04/06: alocar ocupa a vaga, tira da sugestão e põe nos alocados com o prazo", async () => {
    const r = await allocate(schedule, ids.urgent as string);
    expect(r.status).toBe(200);
    expect(r.body.session.taken).toBe(1);
    expect(r.body.allocated).toEqual([
      expect.objectContaining({ entryId: ids.urgent, name: "Ulisses Urgente", state: "allocated", highlighted: false }),
    ]);
    expect(r.body.allocated[0].deadline).toEqual(expect.any(String));
    expect(r.body.suggestion.map((s: { entryId: string }) => s.entryId)).not.toContain(ids.urgent);
  });

  it("INV-08 / I7: dois agendadores na última vaga; o segundo recebe 409 com a lista atualizada", async () => {
    await allocate(schedule, ids.support as string);
    const [a, b] = await Promise.all([allocate(schedule, ids.routine as string), allocate(agenda2, ids.ana as string)]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const lost = a.status === 409 ? a : b;
    expect(lost.body).toMatchObject({ error: "no_slot", data: { allocation: { session: { taken: 3 } } } });
  });

  it("INV-08 / I7: a mesma entrada em duas sessões ao mesmo tempo; só uma aloca", async () => {
    const s1 = await privateOne(5, 3);
    const s2 = await privateOne(5, 4);
    const id = await withoutAccount("Dora Disputa");
    const [a, b] = await Promise.all([allocate(schedule, id, s1), allocate(agenda2, id, s2)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const lost = a.status === 409 ? a : b;
    expect(lost.body.error).toBe("forbidden_transition");
  });

  it("RN-CONF-02/03, I6: lista de ligação com telefone; sem contato anota a tentativa e segue pendente", async () => {
    const allocated = (await allocation(schedule)).body.allocated.find(
      (x: { name: string }) => x.name === "Ana Agenda" || x.name === "Rosa Rotina",
    );
    const r1 = await answer(schedule, allocated.entryId, "no_contact");
    expect(r1).toMatchObject({ status: 200, body: { state: "allocated" } });
    const call = await c.request("GET", `/v1/panel/units/${c.unitId}/call-list`, schedule);
    expect(call.status).toBe(200);
    const item = call.body.find((x: { entryId: string }) => x.entryId === allocated.entryId);
    expect(Date.parse(item.allocatedAt)).toBeLessThan(Date.parse(item.deadline));
    expect(item).toMatchObject({
      name: allocated.name,
      service: "Clínico",
      session: { id: privateId },
      highlighted: false,
      lastAttempt: expect.any(String),
    });
    if (allocated.name === "Ana Agenda") expect(item.phone).toEqual(expect.any(String));
    expect((await c.request("GET", `/v1/panel/units/${c.unitId}/call-list`, c.nurse)).status).toBe(403);
  });

  it("RN-CONF-02/04: confirmou fica confirmada; recusou libera a vaga e não é sugerida de novo nesta sessão", async () => {
    const before = (await allocation(schedule)).body;
    expect((await answer(schedule, ids.urgent as string, "confirmed")).body.state).toBe("confirmed");
    const r = await answer(schedule, ids.support as string, "refused");
    expect(r.body.state).toBe("waiting");
    const after = (await allocation(schedule)).body;
    expect(after.session.taken).toBe(before.session.taken - 1);
    expect(after.suggestion.map((s: { entryId: string }) => s.entryId)).not.toContain(ids.support);
    expect(after.allocated.find((x: { entryId: string }) => x.entryId === ids.urgent).state).toBe("confirmed");
    expect((await answer(schedule, ids.support as string, "confirmed")).status).toBe(409);
  });

  it("lista de espera da unidade: por serviço, com as sessões privadas futuras e os alertas", async () => {
    const r = await c.request("GET", `/v1/panel/units/${c.unitId}/waitlist`, schedule);
    expect(r.status).toBe(200);
    const general = r.body.find((s: { service: { id: string } }) => s.service.id === c.serviceId);
    expect(general.sessions.map((s: { id: string }) => s.id)).toContain(privateId);
    expect(general.sessions.find((s: { id: string }) => s.id === privateId)).toMatchObject({
      slots: 3,
      taken: 2,
      confirmed: 1,
      pending: 1,
    });
    expect(general.waiting).toBeGreaterThanOrEqual(1);
    expect(general.alerts).toBe(1); // Aline voltou à lista; urgente sugerida não alocada
  });
});
