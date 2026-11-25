import { and, eq } from "drizzle-orm";
import { audit } from "infra/database/municipal/schema/audit";
import orchestrator from "tests/orchestrator";
import { queueScenario } from "tests/queue";
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
