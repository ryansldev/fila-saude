import { allowed, conditionsInUnit } from "infra/panel/guard";
import { describe, expect, it } from "vitest";

const U1 = "u1";
const U2 = "u2";

describe("guard pela matriz", () => {
  it("RN-PERF-01: admin passa na ação de configurar na própria unidade; não na outra", async () => {
    const admin = [{ profile: "unit_manager" as const, unitId: U1 }];
    expect(await allowed(admin, "configure_services_sessions_stations_tv", U1)).toBe(true);
    expect(await allowed(admin, "configure_services_sessions_stations_tv", U2)).toBe(false);
  });

  it("profissional em configurar → negado; gestor passa na gestão em qualquer unidade", async () => {
    expect(await allowed([{ profile: "care", unitId: U1 }], "configure_services_sessions_stations_tv", U1)).toBe(false);
    expect(await allowed([{ profile: "sms_management", unitId: null }], "create_units_and_rules", U2)).toBe(true);
  });

  it("ação sem unidade só conta perfil de escopo município", () => {
    expect(
      conditionsInUnit([{ profile: "unit_manager", unitId: U1 }], "configure_services_sessions_stations_tv", null),
    ).toBeNull();
    expect(conditionsInUnit([{ profile: "sms_management", unitId: null }], "create_units_and_rules", null)).toBe(
      "free",
    );
  });

  it("perfis acumulados somam", async () => {
    const profiles = [
      { profile: "care" as const, unitId: U1 },
      { profile: "unit_manager" as const, unitId: U1 },
    ];
    expect(await allowed(profiles, "configure_services_sessions_stations_tv", U1)).toBe(true);
  });

  it("P1: profissional em operate_calls sem a ressalva conferida → negado; conferida → passa", async () => {
    const prof = [{ profile: "care" as const, unitId: U1 }];
    expect(await allowed(prof, "operate_calls", U1)).toBe(false);
    expect(await allowed(prof, "operate_calls", U1, { atendimento: () => false })).toBe(false);
    expect(await allowed(prof, "operate_calls", U1, { atendimento: async () => true })).toBe(true);
  });

  it("P1: recepção em view_life_risk_answer sem conferência → negado", async () => {
    expect(await allowed([{ profile: "reception", unitId: U1 }], "view_life_risk_answer", U1)).toBe(false);
  });
});
