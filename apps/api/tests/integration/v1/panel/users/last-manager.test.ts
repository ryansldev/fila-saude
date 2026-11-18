import { eq } from "drizzle-orm";
import { userRole } from "infra/database/municipal/schema/staff";
import orchestrator from "tests/orchestrator";
import { loggedInUser, municipalityWithUnit, sms } from "tests/panel";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let slug: string;
let manager: string;
let managerId: string;

beforeAll(async () => {
  await orchestrator.waitForAllServices();
  ({ slug, manager } = await municipalityWithUnit());
  managerId = (await orchestrator.panelRequest(slug, "GET", "/v1/panel/me", { cookie: manager })).body.id;
});
afterAll(() => orchestrator.dropMunicipalities());

describe("o município nunca fica sem Gestão SMS", () => {
  it("os dois únicos gestores removendo um ao outro ao mesmo tempo: só uma remoção passa", async () => {
    const second = await loggedInUser(slug, manager, "gestora2", sms());
    const results = await Promise.all([
      orchestrator.panelRequest(slug, "DELETE", `/v1/panel/users/${second.id}`, { cookie: manager }),
      orchestrator.panelRequest(slug, "DELETE", `/v1/panel/users/${managerId}`, { cookie: second.cookie }),
    ]);
    expect(results.filter((r) => r.status === 204)).toHaveLength(1);
    const left = await orchestrator
      .municipalityDatabase(slug)
      .selectDistinct({ id: userRole.userId })
      .from(userRole)
      .where(eq(userRole.role, "sms_management"));
    expect(left).toHaveLength(1);
  });
});
