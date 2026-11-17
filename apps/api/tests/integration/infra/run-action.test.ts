import { eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import { localPerson } from "infra/database/municipal/schema/local-person";
import { runAction, userContext } from "infra/panel/action";
import orchestrator from "tests/orchestrator";
import { occupation } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let a: string;
let b: string;
let managerId: string;
let unitId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  const m = await orchestrator.createMunicipality();
  a = m.slug;
  managerId = m.managerId as string;
  ({ slug: b } = await orchestrator.createMunicipality());
  unitId = await orchestrator.createDirectUnit(a);
});
afterAll(() => orchestrator.dropMunicipalities());

const db = () => orchestrator.municipalityDatabase(a);
const savePerson = (name: string) => async (tx: Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0]) => {
  const [p] = await tx.insert(localPerson).values({ name, birthDate: "1990-01-01" }).returning();
  return p as { id: string };
};

describe("runAction", () => {
  it("INV-12: ação grava uma auditoria com quem, o quê, quando e alvo", async () => {
    const ctx = await userContext(db(), managerId, Date.now());
    const p = await runAction(
      ctx,
      { action: "create_units_and_rules", target: { kind: "person", id: (r) => r.id } },
      savePerson("Auditada"),
    );
    const rows = await db().select().from(audit).where(eq(audit.targetId, p.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: managerId,
      action: "create_units_and_rules",
      targetKind: "person",
    });
  });

  it("INV-12: ação que falha depois de gravar não deixa nem o dado nem a auditoria", async () => {
    const ctx = await userContext(db(), managerId, Date.now());
    const before = (await db().select().from(audit)).length;
    await expect(
      runAction(ctx, { action: "create_units_and_rules", target: { kind: "person", id: "x" } }, async (tx) => {
        await savePerson("Fantasma")(tx);
        throw new Error("falhou depois");
      }),
    ).rejects.toThrow("falhou depois");
    expect(await db().select().from(localPerson).where(eq(localPerson.name, "Fantasma"))).toHaveLength(0);
    expect((await db().select().from(audit)).length).toBe(before);
  });

  it("RN-PERF-03: sem motivo → 400 motivo_obrigatorio", async () => {
    const ctx = await userContext(db(), managerId, Date.now());
    await expect(
      runAction(
        ctx,
        { action: "create_units_and_rules", target: { kind: "person", id: "x" }, requiresReason: true },
        savePerson("SemMotivo"),
      ),
    ).rejects.toMatchObject({ status: 400, code: "reason_required" });
  });

  it("PD-41: fora do HTTP confere a permissão do usuário — profissional na ação de gestão → 403", async () => {
    const u = await orchestrator.createUserWithProfiles(a, "prof", occupation(unitId, "physician"));
    const ctx = await userContext(db(), u.id, Date.now());
    const before = (await db().select().from(audit)).length;
    await expect(
      runAction(ctx, { action: "create_units_and_rules", target: { kind: "person", id: "x" } }, savePerson("Nao")),
    ).rejects.toMatchObject({ status: 403, code: "no_permission" });
    expect((await db().select().from(audit)).length).toBe(before);
  });

  it("auditoria de A não aparece em B", async () => {
    expect(await orchestrator.municipalityDatabase(b).select().from(audit)).toHaveLength(0);
  });
});
