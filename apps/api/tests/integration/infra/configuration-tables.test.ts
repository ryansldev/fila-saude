import { SESSION_TRANSITIONS } from "@fila-saude/domain";
import { sql } from "drizzle-orm";
import { service } from "infra/database/municipal/schema/service";
import { session } from "infra/database/municipal/schema/session";
import orchestrator from "tests/orchestrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let unitId: string;
let serviceId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug } = await orchestrator.createMunicipality({ manager: null }));
  unitId = await orchestrator.createDirectUnit(slug);
});
afterAll(() => orchestrator.dropMunicipalities());

const db = () => orchestrator.municipalityDatabase(slug);
const tomorrow = (h: number) => new Date(Date.UTC(2026, 10, 13, h));

async function failure(p: Promise<unknown>) {
  return p.then(
    () => false,
    () => true,
  );
}

describe("tabelas da configuração", () => {
  it("modelo: padrões — serviço livre, sem triagem, 15 min; sessão privada, planejada, sem dispensa", async () => {
    const [s] = await db().insert(service).values({ unitId, name: "Clínico", prefix: "C" }).returning();
    expect(s).toMatchObject({ mode: "direct", requiresTriage: false, averageCareTimeMin: 15, active: true });
    serviceId = s?.id as string;
    const [x] = await db()
      .insert(session)
      .values({ serviceId, start: tomorrow(11), end: tomorrow(15) })
      .returning();
    expect(x).toMatchObject({ visibility: "private", state: "planned", waivesPreRegistration: false, taken: 0 });
  });

  it("T2.3: prefixo repetido na mesma unidade é recusado; de 3 letras aceito, de 4 recusado", async () => {
    expect(await failure(db().insert(service).values({ unitId, name: "Outro", prefix: "C" }))).toBe(true);
    expect(await failure(db().insert(service).values({ unitId, name: "Três", prefix: "ABC" }))).toBe(false);
    expect(await failure(db().insert(service).values({ unitId, name: "Quatro", prefix: "ABCD" }))).toBe(true);
    const other = await orchestrator.createDirectUnit(slug, "UBS 2");
    expect(await failure(db().insert(service).values({ unitId: other, name: "C2", prefix: "C" }))).toBe(false);
  });

  it("INV-02: vagas 0 recusado, 1 aceito; ocupadas = vagas aceito, vagas + 1 recusado", async () => {
    const base = { serviceId, start: tomorrow(11), end: tomorrow(15) };
    expect(
      await failure(
        db()
          .insert(session)
          .values({ ...base, slots: 0 }),
      ),
    ).toBe(true);
    expect(
      await failure(
        db()
          .insert(session)
          .values({ ...base, slots: 1, taken: 1 }),
      ),
    ).toBe(false);
    expect(
      await failure(
        db()
          .insert(session)
          .values({ ...base, slots: 1, taken: 2 }),
      ),
    ).toBe(true);
  });

  it("AD-016: dispensa em sessão privada recusada pelo banco; fim antes do início recusado", async () => {
    const base = { serviceId, start: tomorrow(11), end: tomorrow(15) };
    expect(
      await failure(
        db()
          .insert(session)
          .values({ ...base, waivesPreRegistration: true }),
      ),
    ).toBe(true);
    expect(
      await failure(
        db()
          .insert(session)
          .values({ ...base, visibility: "public", waivesPreRegistration: true }),
      ),
    ).toBe(false);
    expect(
      await failure(
        db()
          .insert(session)
          .values({ ...base, end: tomorrow(10) }),
      ),
    ).toBe(true);
  });

  it("contrato: estados de sessao no banco são os do domínio", async () => {
    const r = await db().execute<{ v: string }>(sql`select unnest(enum_range(null::session_state))::text as v`);
    const fromDomain = new Set(SESSION_TRANSITIONS.flatMap((t) => [t.de, t.for]).filter((e) => /^[a-z]+$/.test(e)));
    expect(new Set(r.rows.map((l) => l.v))).toEqual(fromDomain);
  });
});
