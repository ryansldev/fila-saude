import { type Answers, open } from "@fila-saude/domain";
import { eq } from "drizzle-orm";
import { service } from "infra/database/municipal/schema/service";
import { session, sessionStation } from "infra/database/municipal/schema/session";
import { station, stationService } from "infra/database/municipal/schema/station";
import { buildDay, inSession, readDay } from "infra/queue/day";
import { joinWaitlist } from "infra/queue/entries";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let serviceId: string;
let stationId: string;

const answers: Answers = { alarms: [], reason: "follow_up", severity: null, conditions: [], groups: [] };
const now = Date.UTC(2026, 10, 12, 12);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.createMunicipality({ manager: null }));
  const unitId = await orchestrator.createDirectUnit(slug);
  const db = orchestrator.municipalityDatabase(slug);
  const [s] = await db
    .insert(service)
    .values({ unitId, name: "Clínico", prefix: "C", averageCareTimeMin: 12 })
    .returning();
  serviceId = s?.id as string;
  const [e] = await db.insert(station).values({ unitId, name: "Sala 1", stage: "care" }).returning();
  stationId = e?.id as string;
  await db.insert(stationService).values({ stationId, serviceId });
});
afterAll(() => orchestrator.dropMunicipalities());

const db = () => orchestrator.municipalityDatabase(slug);

async function newSession() {
  const [s] = await db()
    .insert(session)
    .values({
      serviceId,
      start: new Date(now),
      end: new Date(now + 4 * 3600_000),
      slots: 10,
      visibility: "public",
    })
    .returning();
  await db()
    .insert(sessionStation)
    .values({ sessionId: s?.id as string, stationId });
  return s?.id as string;
}

describe("fila do dia (PD-43, PD-44)", () => {
  it("PD-44: sessão planejada não tem dia gravado; montarDia usa serviço, estações e config", async () => {
    const id = await newSession();
    expect(await readDay(db(), id)).toBeNull();
    const day = await buildDay(db(), id);
    expect(day).toMatchObject({
      sessionId: id,
      serviceId,
      state: "planned",
      ticketPrefix: "C",
      requiresTriage: false,
      nextNumber: 1,
      initialTimeMin: { care: 12 },
      stations: [{ id: stationId, stage: "care", services: [serviceId], open: true, calledItemId: null }],
    });
    expect(day.config.timeZone).toBe("America/Sao_Paulo");
  });

  it("PD-43: abrir grava o dia, o estado da sessão e as entradas na mesma transação", async () => {
    const id = await newSession();
    const e = await joinWaitlist(db(), {
      serviceId,
      person: { name: "Ana", birthDate: "1980-01-01", cpf: orchestrator.generateCpf(), patientId: null },
      guardianPatientId: null,
      answers,
      now,
    });
    if (!e.ok) throw new Error(e.error);
    // Confirmada na sessão, como depois de uma inscrição.
    await inSession(db(), id, async (c) => ({
      entries: [{ ...e.state, state: "confirmed", sessionId: id }],
      session: { ...c.session, taken: 1 },
      result: null,
    }));
    await inSession(db(), id, async (c) => {
      const r = open(c.day ?? (await buildDay(c.tx, id)), c.entries, now);
      if (!r.ok) throw new Error(r.error);
      return { day: r.state.day, entries: r.state.entries, result: null };
    });
    const day = await readDay(db(), id);
    expect(day?.state).toBe("open");
    expect(day?.items.map((i) => i.ticket)).toEqual(["C-001"]);
    const [row] = await db().select().from(session).where(eq(session.id, id));
    expect(row).toMatchObject({ state: "open", taken: 1 });
    await inSession(db(), id, async (c) => {
      expect(c.entries.map((x) => x.state)).toEqual(["in_queue"]);
      return { result: null };
    });
  });

  it("L-003: duas transações na mesma sessão ficam em série e nenhuma perde a escrita", async () => {
    const id = await newSession();
    const sum = () =>
      inSession(db(), id, async (c) => {
        await new Promise((r) => setTimeout(r, 50));
        return { session: { ...c.session, taken: c.session.taken + 1 }, result: null };
      });
    await Promise.all([sum(), sum(), sum()]);
    const [row] = await db().select().from(session).where(eq(session.id, id));
    expect(row?.taken).toBe(3);
  });
});
