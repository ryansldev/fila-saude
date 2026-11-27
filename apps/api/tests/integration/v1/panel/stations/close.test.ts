import { and, desc, eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import { entry } from "infra/database/municipal/schema/entry";
import { session } from "infra/database/municipal/schema/session";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
});
afterAll(() => orchestrator.dropMunicipalities());

const cmd = (stationId: string, command: string) =>
  c.request("POST", `/v1/panel/stations/${stationId}/${command}`, c.nurse, {});

describe("fechar e reabrir a estação (RN-EST-07)", () => {
  it("com outra estação aberta, fecha: a estação diz desde quando e não chama", async () => {
    const r = await cmd(c.e2, "close");
    expect(r.status).toBe(200);
    expect(r.body.station.closedAt).toEqual(expect.any(String));
    expect((await cmd(c.e2, "call")).body.called).toBeNull();
    const op = await c.request("GET", `/v1/panel/stations/${c.e2}/operation`, c.nurse);
    expect(op.body.station.closedAt).toBe(r.body.station.closedAt);
  });

  it("a última estação aberta não fecha sem confirmar (encerraria a sessão)", async () => {
    const r = await cmd(c.e1, "close");
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: "closes_session" });
  });

  it("reabrir devolve a estação à sessão; reabrir de novo é recusado", async () => {
    const r = await cmd(c.e2, "reopen");
    expect(r.status).toBe(200);
    expect(r.body.station.closedAt).toBeNull();
    expect((await cmd(c.e2, "reopen")).status).toBe(409);
    // As duas ações ficam na auditoria da estação.
    const logged = await orchestrator
      .municipalityDatabase(c.slug)
      .select({ data: audit.data })
      .from(audit)
      .where(and(eq(audit.targetKind, "station"), eq(audit.targetId, c.e2)));
    expect(logged.map((l) => (l.data as { command?: string } | null)?.command)).toEqual(
      expect.arrayContaining(["close", "reopen"]),
    );
  });
});

const stateOf = async (slug: string, entryId: string) =>
  (await orchestrator.municipalityDatabase(slug).select({ s: entry.state }).from(entry).where(eq(entry.id, entryId)))[0]
    ?.s;

describe("fechar a última estação do atendimento (RN-EST-07)", () => {
  // FE1: encerrar a sessão é da gestão da unidade; a enfermeira que também gere a unidade fecha e encerra.
  const nurseManager = async (t: Awaited<ReturnType<typeof queueScenario>>) =>
    (await loggedInUser(t.slug, t.manager, "enfermeira_gestora", occupation(t.unitId, "nurse", "unit_manager"))).cookie;

  it("quem não gere a unidade não encerra a sessão: com a confirmação, recusa e a sessão segue aberta", async () => {
    const t = await queueScenario();
    await t.request("POST", `/v1/panel/sessions/${t.sessionId}/open`, t.admin);
    const close = (id: string, body: unknown) => t.request("POST", `/v1/panel/stations/${id}/close`, t.nurse, body);
    expect((await close(t.e2, {})).status).toBe(200);
    const op = await t.request("GET", `/v1/panel/stations/${t.e1}/operation`, t.nurse);
    expect(op.body).toMatchObject({ station: { closing: "closes_session" }, canCloseSession: false });
    const r = await close(t.e1, { confirmed: true });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ error: "no_permission" });
    const db = orchestrator.municipalityDatabase(t.slug);
    const [row] = await db.select({ state: session.state }).from(session).where(eq(session.id, t.sessionId));
    expect(row?.state).toBe("open");
  });

  it("com a confirmação, fecha e encerra a sessão: quem espera é remanejado", async () => {
    const t = await queueScenario();
    await t.request("POST", `/v1/panel/sessions/${t.sessionId}/open`, t.admin);
    const ana = await signUpPerson(t.slug, t.sessionId, "Ana Souza");
    const boss = await nurseManager(t);
    expect((await t.request("GET", `/v1/panel/stations/${t.e1}/operation`, boss)).body.canCloseSession).toBe(true);
    const close = (id: string, body: unknown) => t.request("POST", `/v1/panel/stations/${id}/close`, boss, body);
    expect((await close(t.e2, {})).status).toBe(200);
    expect((await close(t.e1, {})).body).toMatchObject({ error: "closes_session" });
    const r = await close(t.e1, { confirmed: true });
    expect(r.status).toBe(200);
    // A resposta é a da estação sem sessão (como a próxima consulta), com o aviso de que encerrou: sem "Reabrir".
    expect(r.body).toMatchObject({ session: null, notice: "session_closed", station: { closedAt: null } });
    const db = orchestrator.municipalityDatabase(t.slug);
    const [row] = await db.select({ state: session.state }).from(session).where(eq(session.id, t.sessionId));
    expect(row?.state).toBe("closed");
    expect(await stateOf(t.slug, ana.id)).toBe("reassigned");
    const [logged] = await db
      .select({ data: audit.data })
      .from(audit)
      .where(and(eq(audit.targetKind, "station"), eq(audit.targetId, t.e1)))
      .orderBy(desc(audit.at))
      .limit(1);
    expect(logged?.data).toMatchObject({ command: "close", consequence: "closes_session" });
  });

  it("a tela da estação diz o que fechar faz (para confirmar antes de tocar)", async () => {
    const t = await queueScenario({ triage: true });
    await t.request("POST", `/v1/panel/sessions/${t.sessionId}/open`, t.admin);
    const op = (id: string) => t.request("GET", `/v1/panel/stations/${id}/operation`, t.nurse);
    expect((await op(t.e1)).body.station.closing).toBeNull();
    expect((await op(t.t1 as string)).body.station.closing).toBe("closes_stage");
    await t.request("POST", `/v1/panel/stations/${t.e2}/close`, t.nurse, {});
    expect((await op(t.e1)).body.station.closing).toBe("closes_session");
  });
});

describe("fechar a última estação da triagem (RN-EST-07)", () => {
  it("fecha a triagem: quem espera por ela é remanejado e a sessão não aceita gente nova até reabrir", async () => {
    const t = await queueScenario({ triage: true, slots: 1 });
    await t.request("POST", `/v1/panel/sessions/${t.sessionId}/open`, t.admin);
    const ana = await signUpPerson(t.slug, t.sessionId, "Ana Souza");
    const bruno = await signUpPerson(t.slug, t.sessionId, "Bruno Lima");
    expect(bruno.state).toBe("in_reserve");
    const tri = t.t1 as string;
    const close = (body: unknown) => t.request("POST", `/v1/panel/stations/${tri}/close`, t.nurse, body);
    expect((await close({})).body).toMatchObject({ error: "closes_stage" });
    const r = await close({ confirmed: true });
    expect(r.status).toBe(200);
    expect(r.body.session.state).toBe("open");
    expect(await stateOf(t.slug, ana.id)).toBe("reassigned");
    // A reserva espera a triagem reabrir; a inscrição nova é recusada.
    expect(await stateOf(t.slug, bruno.id)).toBe("in_reserve");
    await expect(signUpPerson(t.slug, t.sessionId, "Carla Dias")).rejects.toMatchObject({ code: "triage_closed" });

    const back = await t.request("POST", `/v1/panel/stations/${tri}/reopen`, t.nurse, {});
    expect(back.status).toBe(200);
    // A vaga da Ana ficou livre: o Bruno sai da reserva para a fila.
    expect(await stateOf(t.slug, bruno.id)).toBe("in_queue");
  });
});
