import type { SessionDay } from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import { sessionDay } from "infra/database/municipal/schema/session-day";
import { station } from "infra/database/municipal/schema/station";
import { tv } from "infra/database/municipal/schema/tv";
import orchestrator from "tests/orchestrator";
import { loggedInUser, occupation, UNIT } from "tests/panel";
import { queueScenario } from "tests/queue";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let c: Awaited<ReturnType<typeof queueScenario>>;
let reception: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  c = await queueScenario();
  reception = (await loggedInUser(c.slug, c.manager, "reception", occupation(c.unitId, "reception"))).cookie;
});
afterAll(() => orchestrator.dropMunicipalities());

const MIN = 60_000;
const db = () => orchestrator.municipalityDatabase(c.slug);
const alerts = (cookie = reception) => c.request("GET", `/v1/panel/units/${c.unitId}/signal-alerts`, cookie);

describe("QP2: alerta de sinal no painel da unidade", () => {
  it("sem sessão aberta, nenhum alerta", async () => {
    const r = await alerts();
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });

  it("com a sessão aberta há 10 min (a hora da abertura, não a marcada): a TV e as estações sem sinal entram; a estação que dá sinal sai", async () => {
    await c.request("POST", `/v1/panel/sessions/${c.sessionId}/open`, c.admin);
    const opened = new Date(Date.now() - 10 * MIN);
    const [row] = await db()
      .select({ day: sessionDay.day })
      .from(sessionDay)
      .where(eq(sessionDay.sessionId, c.sessionId));
    const day = { ...(row?.day as SessionDay), openedAt: opened.getTime() };
    await db().update(sessionDay).set({ day }).where(eq(sessionDay.sessionId, c.sessionId));
    const tvSignal = new Date(Date.now() - 5 * MIN);
    const [paired] = await db()
      .insert(tv)
      .values({ code: "123456", tokenHash: "hash-alerta", unitId: c.unitId, pairedAt: opened, lastSignalAt: tvSignal })
      .returning({ id: tv.id });

    const r = await alerts();
    expect(r.status).toBe(200);
    expect(r.body).toEqual([
      { kind: "tv", id: paired?.id, name: null, since: tvSignal.toISOString() },
      { kind: "station", id: c.e1, name: "Sala 1", since: opened.toISOString() },
      { kind: "station", id: c.e2, name: "Sala 2", since: opened.toISOString() },
    ]);

    // A tela da estação aberta dá sinal: sai do alerta.
    await c.request("GET", `/v1/panel/stations/${c.e1}/operation`, c.nurse);
    const after = await alerts(c.nurse);
    expect(after.body.map((a: { id: string }) => a.id)).toEqual([paired?.id, c.e2]);

    // Estação arquivada não entra.
    await db().update(station).set({ archivedAt: new Date() }).where(eq(station.id, c.e2));
    expect((await alerts(c.admin)).body.map((a: { id: string }) => a.id)).toEqual([paired?.id]);
  });

  it("quem não é da unidade não vê", async () => {
    const other = (await c.request("POST", "/v1/panel/units", c.manager, { ...UNIT, name: "UBS Norte" })).body
      .id as string;
    const outside = (await loggedInUser(c.slug, c.manager, "other", occupation(other, "reception"))).cookie;
    expect((await alerts(outside)).status).toBe(403);
  });
});
