import type { MyEntry } from "@fila-saude/schemas/queue";
import { eq } from "drizzle-orm";
import { entry } from "infra/database/municipal/schema/entry";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, ROUTINE, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let t1: string;
let davi: Awaited<ReturnType<typeof orchestrator.loginPatient>>;
let reception: string;
const entries: Record<string, string> = {};

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario({ triage: true });
  t1 = c.t1 as string;
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  const answers = {
    Ana: { ...ROUTINE, alarms: ["self_harm" as const] },
    Bruno: { ...ROUTINE, reason: "new" as const, severity: "moderate" as const },
    Carla: ROUTINE,
  };
  for (const [name, r] of Object.entries(answers))
    entries[name] = (await signUpPerson(c.slug, c.sessionId, name, r)).id;
  // Davi tem conta: o app dele mostra a etapa.
  davi = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Davi" }));
  const signup = await fromApp("POST", `/v1/municipalities/${c.slug}/sessions/${c.sessionId}/sign-ups`, davi.cookie, {
    forWhom: { kind: "me" },
    answers: ROUTINE,
  });
  entries.Davi = (signup as { entryId: string }).entryId;
  await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
  for (const n of [...Object.keys(answers), "Davi"]) {
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: entries[n],
      result: "matches",
    });
  }
});
afterAll(() => orchestrator.dropMunicipalities());

async function fromApp(method: string, path: string, cookie: string, body?: unknown): Promise<unknown> {
  const r = await fetch(`${webserver.origin}${path}`, {
    method: method,
    headers: { cookie, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return r.json();
}

const post = (stationId: string, command: string, body: unknown = {}) =>
  c.request("POST", `/v1/panel/stations/${stationId}/${command}`, c.nurse, body);
// Na triagem, fechar o chamado pede a pessoa na sala ("Compareceu"), como a estação faz.
const cmd = async (stationId: string, command: string, body: unknown = {}) => {
  if (stationId === t1 && (command === "call" || command === "finish")) await post(t1, "showed-up");
  return post(stationId, command, body);
};
const savedRisk = async (name: string) => {
  const [e] = await orchestrator
    .municipalityDatabase(c.slug)
    .select({ r: entry.confirmedRisk, state: entry.state })
    .from(entry)
    .where(eq(entry.id, entries[name] as string));
  return e;
};

describe("triagem (T6.1, fatia 3)", () => {
  it("RN-TRI-01: a sala de atendimento não chama quem ainda não foi triado", async () => {
    expect((await cmd(c.e1, "call")).body.notice).toBe("nobody_waiting");
  });

  it("RN-RISCO-06: a triagem vê o sugerido, a regra e o alerta de apoio de quem chamou", async () => {
    const r = await cmd(t1, "call");
    expect(r.status).toBe(200);
    expect(r.body.called).toMatchObject({
      name: "Ana",
      triage: { suggestedRisk: "urgent", support: true, rule: expect.stringMatching(/própria vida/) },
    });
  });

  it("H3: com alguém chamado, finalizar ou chamar o próximo na triagem pede a classificação", async () => {
    for (const command of ["finish", "call"]) {
      const r = await cmd(t1, command);
      expect(r.status).toBe(422);
      expect(r.body.error).toBe("classify_risk");
    }
  });

  it("RN-TRI-03/04, INV-07: chamar o próximo confirma o risco de quem sai e grava na entrada", async () => {
    const r = await cmd(t1, "call", { confirmedRisk: "attention" });
    expect(r.status).toBe(200);
    expect(r.body.called.name).toBe("Bruno");
    expect(await savedRisk("Ana")).toEqual({ r: "attention", state: "in_queue" });
  });

  it("AD-059: encaminhar à emergência (só com vermelho) conclui a entrada", async () => {
    expect((await cmd(t1, "finish", { confirmedRisk: "urgent", refer: true })).status).toBe(409);
    const r = await cmd(t1, "finish", { confirmedRisk: "emergency", refer: true });
    expect(r.status).toBe(200);
    expect(r.body.called).toBeNull();
    expect(await savedRisk("Bruno")).toEqual({ r: "emergency", state: "completed" });
  });

  it("RN-TRI-04: o triado entra na fila do atendimento; a sala não aceita classificação", async () => {
    const r = await cmd(c.e1, "call");
    expect(r.body.called).toMatchObject({ name: "Ana", stage: "care" });
    expect(r.body.called.triage).toBeUndefined();
    expect((await cmd(c.e1, "finish", { confirmedRisk: "routine" })).status).toBe(409);
  });

  it("app: a etapa de quem espera, 'triado' depois da triagem e 'encaminhado' no vermelho", async () => {
    const my = async () => ((await fromApp("GET", `/v1/municipalities/${c.slug}/mine`, davi.cookie)) as MyEntry[])[0];
    expect(await my()).toMatchObject({ stage: "triage", triaged: false, referred: false });
    await cmd(t1, "call", { confirmedRisk: "routine" }); // ninguém chamado: a cor é ignorada; chama Carla
    // AD-059: vermelho sem encaminhar fica na unidade, em 1º no atendimento.
    await cmd(t1, "call", { confirmedRisk: "emergency" }); // Carla sai da triagem; Davi é chamado
    expect(await savedRisk("Carla")).toEqual({ r: "emergency", state: "in_queue" });
    await cmd(t1, "finish", { confirmedRisk: "very_urgent" }); // AD-058: laranja do Manchester
    expect(await my()).toMatchObject({
      stage: "care",
      triaged: true,
      itemState: "present",
      referred: false,
    });
    expect(await savedRisk("Davi")).toEqual({ r: "very_urgent", state: "in_queue" });
  });
  it("app: quem a triagem encaminhou à emergência aparece como 'encaminhado'", async () => {
    const eva = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Eva" }));
    const signup = (await fromApp("POST", `/v1/municipalities/${c.slug}/sessions/${c.sessionId}/sign-ups`, eva.cookie, {
      forWhom: { kind: "me" },
      answers: ROUTINE,
    })) as { entryId: string };
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: signup.entryId,
      result: "matches",
    });
    await cmd(t1, "call");
    expect((await cmd(t1, "finish", { confirmedRisk: "emergency", refer: true })).status).toBe(200);
    const mine = (await fromApp("GET", `/v1/municipalities/${c.slug}/mine`, eva.cookie)) as MyEntry[];
    expect(mine[0]).toMatchObject({ referred: true, triaged: true });
  });
});
