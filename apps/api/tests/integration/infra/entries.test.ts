import { type Answers, ENTRY_TRANSITIONS } from "@fila-saude/domain";
import { eq, sql } from "drizzle-orm";
import { entry } from "infra/database/municipal/schema/entry";
import { service } from "infra/database/municipal/schema/service";
import { attendedPerson, joinWaitlist, readEntry } from "infra/queue/entries";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let serviceId: string;
let regulatedId: string;

const answers: Answers = { alarms: [], reason: "follow_up", severity: null, conditions: [], groups: [] };
const now = Date.UTC(2026, 10, 12, 12);

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.createMunicipality({ manager: null }));
  const unitId = await orchestrator.createDirectUnit(slug);
  const db = orchestrator.municipalityDatabase(slug);
  const [s] = await db.insert(service).values({ unitId, name: "Odonto", prefix: "O" }).returning();
  const [r] = await db.insert(service).values({ unitId, name: "Reg", prefix: "R", mode: "regulated" }).returning();
  serviceId = s?.id as string;
  regulatedId = r?.id as string;
});
afterAll(() => orchestrator.dropMunicipalities());

const db = () => orchestrator.municipalityDatabase(slug);
const person = (cpf: string | null, patientId: string | null = null, name = "Ana Souza") => ({
  name,
  birthDate: "1958-03-10",
  cpf,
  patientId,
});

describe("entradas", () => {
  it("PD-36: entrada criada pelo domínio volta igual do banco; RN-LE-05 recusa duplicada", async () => {
    const cpf = orchestrator.generateCpf();
    const r = await joinWaitlist(db(), {
      serviceId,
      person: person(cpf, "pac-1"),
      guardianPatientId: "pac-1",
      answers,
      now,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await readEntry(db(), r.state.id)).toEqual(r.state);
    const dup = await joinWaitlist(db(), {
      serviceId,
      person: person(cpf),
      guardianPatientId: null,
      answers,
      now,
    });
    expect(dup).toMatchObject({ ok: false, error: "duplicate" });
  });

  it("RN-LE-02 / AD-035: mesmo CPF é a mesma local_person, e ganha o patient_id", async () => {
    const cpf = orchestrator.generateCpf();
    const a = await attendedPerson(db(), person(cpf));
    const b = await attendedPerson(db(), person(cpf, "pac-2"));
    expect(b.id).toBe(a.id);
    const row = await db().execute<{ patient_id: string }>(sql`select patient_id from local_person where id = ${a.id}`);
    expect(row.rows[0]?.patient_id).toBe("pac-2");
  });

  it("INV-01: segunda entrada ativa da mesma pessoa recusada pelo banco; depois de cancelada, aceita", async () => {
    const r = await joinWaitlist(db(), {
      serviceId,
      person: person(null, null, "José Sem App"),
      guardianPatientId: null,
      answers,
      now,
    });
    if (!r.ok) throw new Error(r.error);
    const [row] = await db().select().from(entry).where(eq(entry.id, r.state.id));
    const copy = { ...row, id: crypto.randomUUID() } as typeof entry.$inferInsert;
    await expect(db().insert(entry).values(copy)).rejects.toThrow();
    await db().update(entry).set({ state: "cancelled" }).where(eq(entry.id, r.state.id));
    await expect(db().insert(entry).values(copy)).resolves.toBeDefined();
  });

  it("RN-LE-01: serviço regulado não cria", async () => {
    const r = await joinWaitlist(db(), {
      serviceId: regulatedId,
      person: person(null),
      guardianPatientId: null,
      answers,
      now,
    });
    expect(r).toMatchObject({ ok: false, error: "regulated_service" });
  });

  it("contrato: estados da entrada no banco são os do domínio", async () => {
    const r = await db().execute<{ v: string }>(sql`select unnest(enum_range(null::entry_state))::text as v`);
    const fromDomain = new Set(ENTRY_TRANSITIONS.flatMap((t) => [t.de, t.for]).filter((e) => /^[a-z_]+$/.test(e)));
    expect(new Set(r.rows.map((l) => l.v))).toEqual(fromDomain);
  });
});
