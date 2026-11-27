import type { SessionDay } from "@fila-saude/domain";
import { and, eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import { notice } from "infra/database/municipal/schema/notice";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import { sweepMunicipality } from "infra/notices/sweep";
import webserver from "infra/webserver";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation } from "tests/panel";
import { CAPTCHA_OK, queueScenario, ROUTINE, signUpPerson } from "tests/queue";
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

describe("a pausa no app (RN-EST-06, RN-ETA)", () => {
  it("com todas as estações em pausa, a estimativa de quem está em casa traz a pausa e a volta", async () => {
    const t = await queueScenario();
    await t.request("POST", `/v1/panel/sessions/${t.sessionId}/open`, t.admin);
    const ana = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Ana Paciente" }));
    const app = async (method: string, path: string, body?: unknown) => {
      const r = await fetch(`${webserver.origin}/v1/municipalities/${t.slug}${path}`, {
        method,
        headers: {
          cookie: ana.cookie,
          ...CAPTCHA_OK,
          ...(body !== undefined ? { "content-type": "application/json" } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    expect(
      (await app("POST", `/sessions/${t.sessionId}/sign-ups`, { forWhom: { kind: "me" }, answers: ROUTINE })).status,
    ).toBe(201);
    const pause = (id: string) => t.request("POST", `/v1/panel/stations/${id}/pause`, t.nurse, { back: { inMin: 60 } });
    expect((await pause(t.e1)).status).toBe(200);
    expect((await pause(t.e2)).status).toBe(200);
    const [mine] = (await app("GET", "/mine")).body;
    expect(mine.estimate).toMatchObject({ kind: "position", pause: { until: expect.any(Number) } });
    // A pausa da etapa vai de quando a última estação parou até a primeira volta (a Sala 1 pausou antes).
    expect(mine.estimate.pause.until - mine.estimate.pause.from).toBeGreaterThan(59 * MIN);
    expect(mine.estimate.pause.until - mine.estimate.pause.from).toBeLessThanOrEqual(60 * MIN);
  });
});

describe("quem chegou no prazo antes da pausa (opção C)", () => {
  let t: Awaited<ReturnType<typeof queueScenario>>;
  let entryId: string;
  const tdb = () => orchestrator.municipalityDatabase(t.slug);
  const day = async () =>
    (await tdb().select({ day: sessionDay.day }).from(sessionDay).where(eq(sessionDay.sessionId, t.sessionId)))[0]
      ?.day as SessionDay;
  const tcmd = (command: string) => t.request("POST", `/v1/panel/stations/${t.e1}/${command}`, t.nurse, {});
  /** A Sala 2 em pausa e a Sala 1 perguntando, com a Bia (chegou no prazo) esperando. */
  const asking = async (sinceAgo = MIN) => {
    const d = await day();
    const bia = d.items.find((i) => i.entryId === entryId);
    if (!bia) throw new Error("bia");
    const now = Date.now();
    const pause = (e: SessionDay["stations"][number]): NonNullable<SessionDay["stations"][number]["pause"]> =>
      e.id === t.e1
        ? { state: "asking", since: now - sinceAgo, askedAt: now - sinceAgo, until: now + 60 * MIN, waitFor: [bia.id] }
        : { state: "paused", since: now - sinceAgo, until: null };
    const stations = d.stations.map((e) => ({ ...e, calledItemId: null, pause: pause(e) }));
    await tdb()
      .update(sessionDay)
      .set({ day: { ...d, stations, heldByPause: [] } })
      .where(eq(sessionDay.sessionId, t.sessionId));
  };
  const app = async (patient: { cookie: string }, method: string, path: string, body?: unknown) => {
    const r = await fetch(`${webserver.origin}/v1/municipalities/${t.slug}${path}`, {
      method,
      headers: {
        cookie: patient.cookie,
        ...CAPTCHA_OK,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    // biome-ignore lint/suspicious/noExplicitAny: a resposta é conferida pelo teste
    return { status: r.status, body: (await r.json()) as any };
  };
  let bia: { cookie: string };
  let desk: string;

  beforeAll(async () => {
    t = await queueScenario();
    await t.request("POST", `/v1/panel/sessions/${t.sessionId}/open`, t.admin);
    desk = (await loggedInUser(t.slug, t.manager, "reception", occupation(t.unitId, "reception"))).cookie;
    bia = await orchestrator.loginPatient(orchestrator.registrationData({ name: "Bia Souza" }));
    const r = await app(bia, "POST", `/sessions/${t.sessionId}/sign-ups`, {
      forWhom: { kind: "me" },
      answers: ROUTINE,
    });
    expect(r.status).toBe(201);
    entryId = (await app(bia, "GET", "/mine")).body[0].entryId;
    await t.request("POST", `/v1/panel/sessions/${t.sessionId}/attendance`, desk, { entryId, result: "matches" });
  });

  it("perguntando: a tela traz quem espera e a volta se atender antes; chamar pede a escolha", async () => {
    await asking();
    const op = await t.request("GET", `/v1/panel/stations/${t.e1}/operation`, t.nurse);
    expect(op.body.station.pause).toMatchObject({
      state: "asking",
      waiting: [{ name: "Bia Souza" }],
      untilIfServed: expect.any(String),
      canServe: true,
    });
    expect(Date.parse(op.body.station.pause.untilIfServed)).toBeGreaterThan(Date.parse(op.body.station.pause.until));
    expect((await tcmd("call")).body).toMatchObject({ error: "pause_has_waiting" });
  });

  it("com duas pessoas, a tela lista primeiro quem 'atender antes' vai chamar (a ordem da fila)", async () => {
    const caio = await signUpPerson(t.slug, t.sessionId, "Caio Lima");
    await t.request("POST", `/v1/panel/sessions/${t.sessionId}/attendance`, desk, {
      entryId: caio.id,
      result: "matches",
    });
    await asking();
    const d = await day();
    const caioItem = d.items.find((i) => i.entryId === caio.id);
    if (!caioItem) throw new Error("caio");
    // O Caio entrou depois, mas com risco maior: é chamado antes da Bia.
    const stations = d.stations.map((e) =>
      e.id === t.e1 && e.pause?.state === "asking"
        ? { ...e, pause: { ...e.pause, waitFor: [...e.pause.waitFor, caioItem.id] } }
        : e,
    );
    const items = d.items.map((i) =>
      i.id === caioItem.id ? { ...i, risk: "urgent" as const, confirmedUrgency: true } : i,
    );
    await tdb()
      .update(sessionDay)
      .set({ day: { ...d, stations, items } })
      .where(eq(sessionDay.sessionId, t.sessionId));
    const op = await t.request("GET", `/v1/panel/stations/${t.e1}/operation`, t.nurse);
    expect(op.body.station.pause.waiting.map((w: { name: string }) => w.name)).toEqual(["Caio Lima", "Bia Souza"]);
    // Tira o Caio da fila para os próximos casos.
    const after = await day();
    await tdb()
      .update(sessionDay)
      .set({ day: { ...after, items: after.items.filter((i) => i.id !== caioItem.id) } })
      .where(eq(sessionDay.sessionId, t.sessionId));
  });

  it("atender antes: chama a Bia e a pausa espera o fim do atendimento", async () => {
    await asking();
    const r = await tcmd("serve-before-pause");
    expect(r.status).toBe(200);
    expect(r.body.called).toMatchObject({ name: "Bia Souza" });
    expect(r.body.station.pause).toEqual({ state: "serving", lengthMin: 61 });
    // Volta para a fila para os próximos casos.
    await tcmd("resume");
    const d = await day();
    await tdb()
      .update(sessionDay)
      .set({
        day: {
          ...d,
          items: d.items.map((i) => (i.entryId === entryId ? { ...i, state: "present" as const } : i)),
          stations: d.stations.map((e) => ({ ...e, calledItemId: null })),
          calls: [],
        },
      })
      .where(eq(sessionDay.sessionId, t.sessionId));
  });

  it("pausar agora: a Bia recebe a justificativa e o app mostra a pausa antes da vez", async () => {
    await asking();
    const r = await tcmd("pause-now");
    expect(r.status).toBe(200);
    expect(r.body.station.pause).toMatchObject({ state: "paused" });
    const sent = await tdb().select({ title: notice.title }).from(notice).where(eq(notice.kind, "turn_after_pause"));
    expect(sent.map((n) => n.title)).toEqual(["sala 1 entrou em pausa"]);
    const [mine] = (await app(bia, "GET", "/mine")).body;
    expect(mine.estimate).toMatchObject({ kind: "position", pause: { beforeTurn: true } });
    await tcmd("resume");
  });

  it("sem resposta em 3 min, a varredura pausa e manda a justificativa", async () => {
    await tdb().delete(notice).where(eq(notice.kind, "turn_after_pause"));
    await asking(4 * MIN);
    await sweepMunicipality(tdb(), Date.now(), async (list) => list.map(() => ({ ok: true })));
    expect((await day()).stations.find((e) => e.id === t.e1)?.pause).toMatchObject({ state: "paused" });
    const sent = await tdb().select({ kind: notice.kind }).from(notice).where(eq(notice.kind, "turn_after_pause"));
    expect(sent).toHaveLength(1);
  });
});
