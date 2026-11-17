import { tokenQr } from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import database from "infra/database";
import { patient } from "infra/database/central/schema/auth";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, ROUTINE } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;
let ana: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
let bruno: Awaited<ReturnType<typeof orchestrator.loginPatient>>;

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
const signUp = (cookie: string, forWhom: unknown = { kind: "me" }) =>
  app("POST", `${m()}/sessions/${c.sessionId}/sign-ups`, cookie, { forWhom, answers: ROUTINE });
const qr = (cookie = reception) => c.request("GET", `/v1/panel/units/${c.unitId}/qr`, cookie);
const tokensOf = (content: string) => (new URL(content).searchParams.get("t") ?? "").split(",");
const c_queue = async () => (await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, reception)).body;
const checkIn = (cookie: string | undefined, tokens: string[]) =>
  app("POST", `${m()}/check-in`, cookie, { unitId: c.unitId, tokens });

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  ana = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Ana Lima" }));
  bruno = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Bruno Reis" }));
  // Bruno já teve a conta verificada numa ida anterior (RN-ID-05).
  await database.update(patient).set({ verifiedAt: new Date() }).where(eq(patient.id, bruno.patientId));
  await signUp(ana.cookie);
  await signUp(bruno.cookie);
  await signUp(bruno.cookie, {
    kind: "other",
    relationship: "legal_guardian",
    declared: true,
    name: "Bia Reis",
    birthDate: "2018-03-03",
    cpf: null,
  });
});
afterAll(() => orchestrator.dropMunicipalities());

describe("QR de entrada (RN-PRES-01, RN-FILA-05)", () => {
  it("sem sessão aberta não há QR; só quem tem a ação na unidade vê o QR", async () => {
    expect((await qr()).body).toMatchObject({ content: null, sessions: [] });
    expect((await qr(c.manager)).status).toBe(403);
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
    const r = await qr();
    expect(r.status).toBe(200);
    const url = new URL(r.body.content);
    expect(url.protocol).toBe("filasaude:");
    expect(url.searchParams.get("m")).toBe(c.slug);
    expect(url.searchParams.get("u")).toBe(c.unitId);
    expect(r.body).toMatchObject({ intervalSeconds: 30, sessions: [{ service: "Clínico" }] });
  });

  it("RNF-SEG-01: sem conta → 401; token inventado ou de duas janelas atrás → qr_invalido", async () => {
    const tokens = tokensOf((await qr()).body.content);
    expect((await checkIn(undefined, tokens)).status).toBe(401);
    expect(await checkIn(bruno.cookie, ["lixo"])).toMatchObject({ status: 409, body: { error: "invalid_qr" } });
    const [row] = await orchestrator
      .municipalityDatabase(c.slug)
      .select({ secret: sessionDay.qrSecret })
      .from(sessionDay)
      .where(eq(sessionDay.sessionId, c.sessionId));
    const old = await tokenQr(row?.secret as string, Date.now() - 60_000);
    expect((await checkIn(bruno.cookie, [old])).body.error).toBe("invalid_qr");
  });

  it("RN-PRES-01 / AD-055: uma leitura vale para a conta; verificada entra presente, a pessoa atendida não conferida fica pendente", async () => {
    const r = await checkIn(bruno.cookie, tokensOf((await qr()).body.content));
    expect(r.status).toBe(200);
    expect(r.body.map((x: { person: string; result: string }) => [x.person, x.result]).sort()).toEqual([
      ["Bia Reis", "pending_check"],
      ["Bruno Reis", "present"],
    ]);
  });

  it("RN-FILA-05: conta não verificada é recusada; a fila e o app mostram a pendência", async () => {
    const r = await checkIn(ana.cookie, tokensOf((await qr()).body.content));
    expect(r.body).toEqual([
      expect.objectContaining({ person: "Ana Lima", result: "pending_check", pendingChecks: ["account"] }),
    ]);
    const queue = await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, reception);
    expect(queue.body.items.find((i: { name: string }) => i.name === "Ana Lima")).toMatchObject({
      state: "remote",
      pendingChecks: ["account"],
    });
    const mine = await app("GET", `${m()}/mine`, ana.cookie);
    expect(mine.body[0]).toMatchObject({ itemState: "remote", pendingChecks: ["account"] });
  });

  it("RN-ID-05: a recepção confere, marca presença e a conta fica verificada para as próximas idas", async () => {
    const queue = await c.request("GET", `/v1/panel/sessions/${c.sessionId}/queue`, reception);
    const item = queue.body.items.find((i: { name: string }) => i.name === "Ana Lima");
    const r = await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: item.entryId,
      result: "matches",
    });
    expect(r.body.items.find((i: { name: string }) => i.name === "Ana Lima")).toMatchObject({
      state: "present",
      pendingChecks: [],
    });
    const [account] = await database.select().from(patient).where(eq(patient.id, ana.patientId));
    expect(account?.verifiedAt).not.toBeNull();
    expect(account?.verificationMethod).toBe("reception");
  });
});

describe('"Vou sair" (RN-PRES-02)', () => {
  const leaving = (cookie: string, entryId: string) => app("POST", `${m()}/entries/${entryId}/leaving`, cookie);
  const fromBruno = async () =>
    (await app("GET", `${m()}/mine`, bruno.cookie)).body.find((e: { person: string }) => e.person === "Bruno Reis");

  it("só a conta responsável; presente volta a remoto mantendo a senha; de novo → transicao_proibida", async () => {
    const before = await fromBruno();
    expect(before).toMatchObject({ itemState: "present" });
    expect((await leaving(ana.cookie, before.entryId)).status).toBe(404);
    const r = await leaving(bruno.cookie, before.entryId);
    expect(r.status).toBe(200);
    expect(await fromBruno()).toMatchObject({ itemState: "remote", ticket: before.ticket });
    expect(await leaving(bruno.cookie, before.entryId)).toMatchObject({
      status: 409,
      body: { error: "forbidden_transition" },
    });
  });
});

describe('"Não vou poder ir" (RN-CANC-01..03)', () => {
  it("só a conta responsável cancela; libera a vaga; a entrada sai da fila e do app como cancelada", async () => {
    const carla = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Carla Dias" }));
    const r = await signUp(carla.cookie);
    expect(r.status).toBe(201);
    const id = r.body.entryId;
    expect((await app("POST", `${m()}/entries/${id}/cancel`, ana.cookie)).status).toBe(404);
    const c = await app("POST", `${m()}/entries/${id}/cancel`, carla.cookie);
    expect(c.status).toBe(200);
    const mine = await app("GET", `${m()}/mine`, carla.cookie);
    expect(mine.body.find((e: { entryId: string }) => e.entryId === id)).toBeUndefined();
    const queue = await c_queue();
    // Fica no dia como "saiu da fila" (histórico); a vaga volta.
    expect(queue.items.find((i: { entryId: string }) => i.entryId === id)).toMatchObject({ state: "left_queue" });
    expect(await app("POST", `${m()}/entries/${id}/cancel`, carla.cookie)).toMatchObject({ status: 409 });
  });
});

describe("QR de novo depois de chamado", () => {
  it("quem já foi chamado lê o QR e ouve 'você já foi chamado', não 'sem senha'", async () => {
    // Aqui só a Ana está na unidade (Bruno saiu, Carla cancelou).
    await c.request("POST", `/v1/panel/stations/${c.e1}/call`, c.nurse, {});
    const r = await checkIn(ana.cookie, tokensOf((await qr()).body.content));
    expect(r.body).toEqual([expect.objectContaining({ person: "Ana Lima", result: "called" })]);
  });
});
