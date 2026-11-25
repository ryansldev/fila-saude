import type { SessionDay } from "@fila-saude/domain";
import { and, eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import { sweepMunicipality } from "infra/notices/sweep";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { queueScenario, signUpPerson } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
  await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
});
afterAll(() => orchestrator.dropMunicipalities());

const MIN = 60_000;
const cmd = (stationId: string, command: string, body: unknown = {}) =>
  c.request("POST", `/v1/panel/stations/${stationId}/${command}`, c.nurse, body);
const operation = (stationId: string) => c.request("GET", `/v1/panel/stations/${stationId}/operation`, c.nurse);
const db = () => orchestrator.municipalityDatabase(c.slug);
const readDay = async () =>
  (await db().select({ day: sessionDay.day }).from(sessionDay).where(eq(sessionDay.sessionId, c.sessionId)))[0]
    ?.day as SessionDay;
const writeDay = (day: SessionDay) => db().update(sessionDay).set({ day }).where(eq(sessionDay.sessionId, c.sessionId));

describe("pausar e voltar (RN-EST-06)", () => {
  it("sem ninguém a caminho, a tela diz que a pausa começaria agora", async () => {
    const r = await operation(c.e1);
    expect(r.body.station.pause).toBeNull();
    const startsAt = Date.parse(r.body.station.pauseStartsAt);
    expect(Math.abs(startsAt - Date.parse(r.body.now))).toBeLessThan(5_000);
  });

  it("pausa agora com a volta em 30 min: em pausa, não chama; voltar agora devolve a estação", async () => {
    const r = await cmd(c.e1, "pause", { back: { inMin: 30 } });
    expect(r.status).toBe(200);
    expect(r.body.station.pause).toMatchObject({ state: "paused" });
    const { from, until } = r.body.station.pause;
    expect(Date.parse(until) - Date.parse(from)).toBe(30 * MIN);
    // Em pausa não pausa de novo, e a tela não oferece outra pausa.
    expect(r.body.station.pauseStartsAt).toBeNull();
    expect((await cmd(c.e1, "pause", { back: null })).body).toMatchObject({ error: "station_already_paused" });
    expect((await cmd(c.e1, "call")).body).toMatchObject({ error: "station_paused" });

    const back = await cmd(c.e1, "resume");
    expect(back.status).toBe(200);
    expect(back.body.station.pause).toBeNull();
    const logged = await db()
      .select({ data: audit.data })
      .from(audit)
      .where(and(eq(audit.targetKind, "station"), eq(audit.targetId, c.e1)));
    expect(logged.map((l) => (l.data as { command?: string } | null)?.command)).toEqual(
      expect.arrayContaining(["pause", "resume"]),
    );
  });

  it("a volta num horário; a volta antes do início é recusada", async () => {
    const early = await cmd(c.e2, "pause", { back: { at: new Date(Date.now() - MIN).toISOString() } });
    expect(early.body).toMatchObject({ error: "pause_back_before_start" });
    const at = new Date(Date.now() + 90 * MIN).toISOString();
    const r = await cmd(c.e2, "pause", { back: { at } });
    expect(r.body.station.pause).toMatchObject({ state: "paused", until: at });
    // Sem hora de volta também vale.
    await cmd(c.e2, "resume");
    expect((await cmd(c.e2, "pause", { back: null })).body.station.pause).toMatchObject({ until: null });
    await cmd(c.e2, "resume");
  });

  it("a varredura grava a volta quando a hora passa", async () => {
    await cmd(c.e1, "pause", { back: { inMin: 30 } });
    await sweepMunicipality(db(), Date.now() + 31 * MIN, async (list) => list.map(() => ({ ok: true })));
    const station = (await readDay()).stations.find((e) => e.id === c.e1);
    expect(station?.pause).toBeUndefined();
    expect(station?.stops?.length).toBeGreaterThan(0);
  });

  it("finalizar com a pausa começando só finaliza: a estação entra em pausa, sem 'ninguém aguardando'", async () => {
    const ana = await signUpPerson(c.slug, c.sessionId, "Ana Souza");
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/attendance`, reception, {
      entryId: ana.id,
      result: "matches",
    });
    expect((await cmd(c.e1, "call")).body.called).not.toBeNull();
    await cmd(c.e1, "showed-up");
    // A pausa marcada (alguém estava a caminho quando ela pausou) chega na hora com a Ana na sala.
    const day = await readDay();
    const from = Date.now() - MIN;
    await writeDay({
      ...day,
      stations: day.stations.map((e) =>
        e.id === c.e1 ? { ...e, pause: { state: "scheduled", from, until: null } } : e,
      ),
    });
    const r = await cmd(c.e1, "call");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ called: null, notice: null, station: { pause: { state: "paused" } } });
  });
});
