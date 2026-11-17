import { describe, expect, it } from "vitest";
import { canRegister, OCCUPATIONS, rolesOf, staffProblems } from "../src/staff.ts";

const U1 = "u1";
const U2 = "u2";

describe("equipe (ocupação, funções e papéis)", () => {
  it("ocupação vira papel de permissão na unidade; função de gestão também", () => {
    expect(
      rolesOf({
        unitLinks: [
          { unitId: U1, occupation: "nurse" },
          { unitId: U2, occupation: "physician" },
        ],
        roles: [
          { role: "unit_manager", unitId: U1 },
          { role: "sms_management", unitId: null },
        ],
      }),
    ).toEqual([
      { profile: "nurse", unitId: U1 },
      { profile: "care", unitId: U2 },
      { profile: "unit_manager", unitId: U1 },
      { profile: "sms_management", unitId: null },
    ]);
  });

  it("ACS e auxiliar de saúde bucal entram na equipe sem ação no painel por enquanto", () => {
    expect(OCCUPATIONS.community_health_agent.roles).toEqual([]);
    expect(rolesOf({ unitLinks: [{ unitId: U1, occupation: "community_health_agent" }], roles: [] })).toEqual([]);
  });

  it("escopo: SMS e regulação são do município; gerente e agendar, de uma unidade; ninguém sem atribuição", () => {
    expect(staffProblems({ unitLinks: [], roles: [] })).toEqual({ _: "Informe ao menos uma ocupação ou função." });
    expect(staffProblems({ unitLinks: [], roles: [{ role: "unit_manager", unitId: null }] })).toEqual({
      "funcoes.0.unidadeId": "Escolha a unidade.",
    });
    expect(staffProblems({ unitLinks: [], roles: [{ role: "sms_management", unitId: U1 }] })).toEqual({
      "funcoes.0.unidadeId": "Função do município, sem unidade.",
    });
    expect(staffProblems({ unitLinks: [{ unitId: U1, occupation: "reception" }], roles: [] })).toEqual({});
  });

  it("RN-PERF-04: SMS cadastra qualquer pessoa", () => {
    const sms = { unitLinks: [], roles: [{ role: "sms_management" as const, unitId: null }] };
    expect(canRegister(sms, { unitLinks: [], roles: [{ role: "unit_manager", unitId: U2 }] })).toBe(true);
  });

  it("RN-PERF-04: gerente cadastra só a equipe da própria unidade, sem função de gestão", () => {
    const manager = { unitLinks: [], roles: [{ role: "unit_manager" as const, unitId: U1 }] };
    const technician = { unitLinks: [{ unitId: U1, occupation: "nursing_technician" as const }], roles: [] };
    expect(canRegister(manager, technician)).toBe(true);
    expect(canRegister(manager, { ...technician, roles: [{ role: "scheduler", unitId: U1 }] })).toBe(true);
    expect(canRegister(manager, { unitLinks: [{ unitId: U2, occupation: "physician" }], roles: [] })).toBe(false);
    expect(canRegister(manager, { unitLinks: [], roles: [{ role: "unit_manager", unitId: U1 }] })).toBe(false);
    expect(canRegister(manager, { unitLinks: [], roles: [{ role: "sms_regulation", unitId: null }] })).toBe(false);
  });

  it("RN-PERF-04: quem não é SMS nem gerente não cadastra ninguém", () => {
    const nurse = { unitLinks: [{ unitId: U1, occupation: "nurse" as const }], roles: [] };
    expect(canRegister(nurse, { unitLinks: [{ unitId: U1, occupation: "community_health_agent" }], roles: [] })).toBe(
      false,
    );
  });
});
