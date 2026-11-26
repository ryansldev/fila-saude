import { describe, expect, it } from "vitest";
import { staffMeSchema } from "../auth.ts";
import { serviceEditSchema, serviceSchema } from "../service.ts";
import { sessionEditSchema, sessionSchema, visibilityInputSchema } from "../session.ts";
import { stationEditSchema, stationSchema } from "../station.ts";
import { effectiveConfigSchema, unitEditSchema, unitSchema } from "../unit.ts";
import { assignmentsSchema, staffUserSchema } from "../user.ts";

const ok = (s: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => s.safeParse(v).success;
const id = "6f1c1f0e-8f0a-4b5e-9d0e-1c2b3a4d5e6f";

describe("staffMeSchema", () => {
  it("euPainelSchema aceita perfis com e sem unidade e recusa perfil paciente", () => {
    const me = {
      id: "u1",
      name: "Ana",
      login: "ana",
      unitLinks: [{ unitId: id, occupation: "reception" }],
      roles: [{ role: "sms_management", unitId: null }],
      profiles: [
        { profile: "sms_management", unitId: null },
        { profile: "reception", unitId: id },
      ],
    };
    expect(ok(staffMeSchema, me)).toBe(true);
    expect(ok(staffMeSchema, { ...me, profiles: [{ profile: "patient", unitId: null }] })).toBe(false);
  });
});

describe("contratos da configuração da v0.1", () => {
  it("edição de sessão sem versao é recusada", () => {
    expect(ok(sessionEditSchema, { slots: 3 })).toBe(false);
    expect(ok(sessionEditSchema, { slots: 3, version: 0 })).toBe(true);
    expect(ok(sessionEditSchema, { slots: 0, version: 0 })).toBe(false);
  });
  it("visibilidade exige versao", () => {
    expect(ok(visibilityInputSchema, { visibility: "private" })).toBe(false);
    expect(ok(visibilityInputSchema, { visibility: "private", version: 2 })).toBe(true);
  });
  it("config da unidade aceita null para voltar a herdar", () => {
    expect(ok(unitEditSchema, { config: { windowK: null } })).toBe(true);
    expect(ok(unitEditSchema, { name: "UBS 2" })).toBe(true);
    expect(ok(unitEditSchema, { config: { windowK: 0 } })).toBe(false);
  });
  it("estacaoEdicaoSchema não aceita etapa", () => {
    expect(ok(stationEditSchema, { name: "C1" })).toBe(true);
    expect(ok(stationEditSchema, { name: "C1", stage: "triage" })).toBe(false);
  });
  it("servicoEdicaoSchema parcial", () => {
    expect(ok(serviceEditSchema, { mode: "regulated" })).toBe(true);
    expect(ok(serviceEditSchema, { prefix: "ABCD" })).toBe(false);
  });
  it("atribuições: ocupação na unidade e função com escopo; ocupação desconhecida recusada", () => {
    expect(ok(assignmentsSchema, { unitLinks: [{ unitId: id, occupation: "nurse" }], roles: [] })).toBe(true);
    expect(ok(assignmentsSchema, { unitLinks: [{ unitId: id, occupation: "triage" }], roles: [] })).toBe(false);
    expect(ok(assignmentsSchema, { unitLinks: [], roles: [{ role: "unit_manager", unitId: id }] })).toBe(true);
    expect(ok(assignmentsSchema, { unitLinks: [], roles: [{ role: "admin", unitId: id }] })).toBe(false);
  });
  it("um caso válido de cada saída", () => {
    expect(
      ok(unitSchema, {
        id,
        name: "UBS",
        kind: "ubs",
        address: {
          postalCode: "01001-000",
          street: "Praça da Sé",
          number: "100",
          complement: null,
          neighborhood: "Sé",
        },
        cnes: "2077485",
        lat: 0,
        lng: 0,
        timeZone: "America/Sao_Paulo",
        time: {},
        config: { windowK: 3 },
      }),
    ).toBe(true);
    expect(ok(effectiveConfigSchema, { values: { windowK: 3 }, origin: { windowK: "unit" } })).toBe(true);
    expect(
      ok(serviceSchema, {
        id,
        unitId: id,
        name: "Clínico",
        prefix: "C",
        requiresTriage: true,
        mode: "direct",
        averageTimeMin: { triage: 5, care: 15 },
        active: true,
      }),
    ).toBe(true);
    expect(ok(stationSchema, { id, unitId: id, name: "T1", stage: "triage", services: [id], open: false })).toBe(true);
    expect(
      ok(sessionSchema, {
        id,
        serviceId: id,
        start: "2026-11-12T11:00:00.000Z",
        end: "2026-11-12T15:00:00.000Z",
        breaks: [{ start: "2026-11-12T13:00:00.000Z", end: "2026-11-12T14:00:00.000Z" }],
        slots: null,
        taken: 0,
        visibility: "private",
        waivesPreRegistration: false,
        professional: null,
        stations: [],
        state: "planned",
        version: 0,
      }),
    ).toBe(true);
    expect(
      ok(staffUserSchema, {
        id: "x",
        login: "ana",
        name: "Ana",
        unitLinks: [],
        roles: [{ role: "sms_management", unitId: null }],
      }),
    ).toBe(true);
  });
});
