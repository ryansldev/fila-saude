import { eq } from "drizzle-orm";
import { notice } from "infra/database/municipal/schema/notice";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let schedule: string;
let privateId: string;
const accounts: Record<string, Awaited<ReturnType<typeof orchestrator.loginPatient>>> = {};
const entries: Record<string, string> = {};

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
const my = async (name: string) =>
  (await app("GET", `${m()}/mine`, accounts[name]?.cookie)).body.find(
    (e: { entryId: string }) => e.entryId === entries[name],
  );

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  schedule = (await loggedInUser(c.slug, c.manager, "schedule", occupation(c.unitId, "reception", "scheduler"))).cookie;
  const start = Date.now() + 2 * 86400_000;
  privateId = (
    await c.request("POST", `/v1/panel/units/${c.unitId}/sessions`, c.admin, {
      serviceId: c.serviceId,
      start: new Date(start).toISOString(),
      end: new Date(start + 4 * 3600_000).toISOString(),
      slots: 5,
      visibility: "private",
      waivesPreRegistration: false,
      professional: null,
      stations: [c.e1],
    })
  ).body.id;
  for (const name of ["Ana", "Bruno"]) {
    accounts[name] = await orchestrator.loginPatient(orchestrator.registrationData({ name }));
    entries[name] = (
      await app("POST", `${m()}/services/${c.serviceId}/entries`, accounts[name]?.cookie, {
        forWhom: { kind: "me" },
        answers: { ...ROUTINE, reason: "new", severity: "moderate" },
      })
    ).body.entryId;
    const r = await c.request("POST", `/v1/panel/sessions/${privateId}/allocate`, schedule, { entryId: entries[name] });
    if (r.status !== 200) throw new Error(`alocar: ${r.status} ${JSON.stringify(r.body)}`);
  }
});
afterAll(() => orchestrator.dropMunicipalities());

describe("confirmação pelo app (T5.4)", () => {
  it("RN-CONF-01 / I8: alocar grava o push 'confirme' com serviço, unidade e dia, sem sintoma", async () => {
    const list = await orchestrator
      .municipalityDatabase(c.slug)
      .select()
      .from(notice)
      .where(eq(notice.entryId, entries.Ana as string));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: "confirm", patientId: accounts.Ana?.patientId });
    expect(list[0]?.title).toBe("confirme sua consulta");
    expect(list[0]?.body).toContain("Clínico");
    expect(list[0]?.body).toContain("UBS Centro");
    expect(list[0]?.body).not.toMatch(/moderado|novo/i);
  });

  it("RN-CONF-01: 'minhas' mostra a alocação com o prazo de confirmação", async () => {
    const e = await my("Ana");
    expect(e).toMatchObject({ state: "allocated", session: { id: privateId }, refusalEnds: false });
    expect(Date.parse(e.confirmationDeadline)).toBeGreaterThan(Date.now());
  });

  it("confirmar é só da conta responsável; depois de confirmada, não confirma de novo", async () => {
    const path = `${m()}/entries/${entries.Ana}/confirm`;
    expect((await app("POST", path, accounts.Bruno?.cookie)).status).toBe(404);
    expect(await app("POST", path, accounts.Ana?.cookie)).toMatchObject({
      status: 200,
      body: { state: "confirmed" },
    });
    expect((await my("Ana")).confirmationDeadline).toBeNull();
    expect((await app("POST", path, accounts.Ana?.cookie)).status).toBe(409);
  });

  it("RN-CONF-04: recusar libera a vaga e volta à lista com a data original", async () => {
    const r = await app("POST", `${m()}/entries/${entries.Bruno}/refuse`, accounts.Bruno?.cookie);
    expect(r).toMatchObject({ status: 200, body: { state: "waiting" } });
    expect(await my("Bruno")).toMatchObject({ state: "waiting", session: null });
    const v = await c.request("GET", `/v1/panel/sessions/${privateId}/allocation`, schedule);
    expect(v.body.session.taken).toBe(1);
  });
});
