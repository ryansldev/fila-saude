import { and, desc, eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import { entry } from "infra/database/municipal/schema/entry";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;
let technician: string;
let physician: string;
const entries: Record<string, string> = {};

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  technician = (await loggedInUser(c.slug, c.manager, "tecnico", occupation(c.unitId, "nursing_technician"))).cookie;
  physician = (await loggedInUser(c.slug, c.manager, "medica", occupation(c.unitId, "physician"))).cookie;
  for (const name of ["Ana", "Bruno", "Carla"]) entries[name] = (await signUpPerson(c.slug, c.sessionId, name)).id;
  await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
});
afterAll(() => orchestrator.dropMunicipalities());

const op = (stationId: string, cookie: string, command?: string) =>
  command
    ? c.request("POST", `/v1/panel/stations/${stationId}/${command}`, cookie, {})
    : c.request("GET", `/v1/panel/stations/${stationId}/operation`, cookie);
const attendance = (name: string, cookie = reception) =>
  c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, cookie, {
    entryId: entries[name],
    result: "matches",
  });

describe("estação de chamada (T3.7)", () => {
  it("RN-FILA-05: só a recepção marca presença; remoto não é chamado", async () => {
    expect((await op(c.e1, c.nurse, "call")).body.notice).toBe("nobody_waiting");
    expect((await attendance("Ana", c.nurse)).status).toBe(403);
    for (const n of ["Ana", "Bruno", "Carla"]) expect((await attendance(n)).status).toBe(200);
    const r = await op(c.e1, c.nurse);
    expect(r.body).toMatchObject({ station: { name: "Sala 1" }, called: null, waiting: 3 });
  });

  it("PD-46: gerente não opera; técnico só na triagem → 403 na estação de atendimento", async () => {
    expect((await op(c.e1, c.admin, "call")).status).toBe(403);
    expect((await op(c.e1, technician, "call")).status).toBe(403);
  });

  it("PD-46: profissional de atendimento (médica) opera a estação de atendimento", async () => {
    expect((await op(c.e1, physician)).status).toBe(200);
  });

  it("INV-04 / L-003: duas estações chamando ao mesmo tempo recebem pacientes diferentes", async () => {
    const [a, b] = await Promise.all([op(c.e1, c.nurse, "call"), op(c.e2, c.nurse, "call")]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const names = [a.body.called.name, b.body.called.name].sort();
    expect(names).toEqual(["Ana", "Bruno"]);
  });

  it("RN-CHAM-02/03: rechamar mantém; não compareceu pula; finalizar conclui a entrada", async () => {
    const r = await op(c.e1, c.nurse, "recall");
    expect(r.status).toBe(200);
    const calledE1 = r.body.called.name as string;
    const ticketE1 = r.body.called.ticket as string;
    const skip = await op(c.e1, c.nurse, "no-show");
    expect(skip.body.called).toBeNull();
    // A auditoria guarda sobre quem foi o "não compareceu" (antes) e quem ficou chamado (depois).
    const [logged] = await orchestrator
      .municipalityDatabase(c.slug)
      .select({ data: audit.data })
      .from(audit)
      .where(and(eq(audit.targetKind, "station"), eq(audit.targetId, c.e1)))
      .orderBy(desc(audit.at))
      .limit(1);
    expect(logged?.data).toMatchObject({ command: "no-show", before: ticketE1, after: null });
    const end = await op(c.e2, c.nurse, "finish");
    expect(end.body.called).toBeNull();
    const nameE2 = calledE1 === "Ana" ? "Bruno" : "Ana";
    const [row] = await orchestrator
      .municipalityDatabase(c.slug)
      .select({ state: entry.state })
      .from(entry)
      .where(eq(entry.id, entries[nameE2] as string));
    expect(row?.state).toBe("completed");
  });

  it("RN-CHAM-01: chamar sem ninguém finaliza o chamado e avisa", async () => {
    // Restam Carla e quem foi pulado (presente de novo); chama até esvaziar.
    let r = await op(c.e1, c.nurse, "call");
    for (let i = 0; i < 4 && r.body.notice === null; i++) r = await op(c.e1, c.nurse, "call");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ called: null, notice: "nobody_waiting", waiting: 0 });
  });
});
