import { describe, expect, it } from "vitest";
import { changeVisibility, type SessionConfig, validateSession } from "../src/config-session.ts";
import { freeze } from "./fixtures.ts";

const BASE: SessionConfig = freeze({
  slots: 10,
  visibility: "public",
  waivesPreRegistration: false,
  professional: null,
  stations: ["e1"],
});
const FREE = freeze({ mode: "direct" as const, serviceStations: ["e1", "e2"] });
const REGULATED = freeze({ mode: "regulated" as const, serviceStations: ["e1", "e2"] });

describe("validateSession", () => {
  it("INV-02: vagas 0 recusado, 1 aceito, nulo aceito", () => {
    expect(validateSession(FREE, { ...BASE, slots: 0 })).toEqual({
      ok: false,
      error: "invalid_input",
      fields: { slots: expect.any(String) },
    });
    expect(validateSession(FREE, { ...BASE, slots: 1.5 }).ok).toBe(false);
    expect(validateSession(FREE, { ...BASE, slots: 1 })).toEqual({ ok: true });
    expect(validateSession(FREE, { ...BASE, slots: null })).toEqual({ ok: true });
  });

  it("AD-016: dispensa só em pública", () => {
    expect(validateSession(FREE, { ...BASE, waivesPreRegistration: true })).toEqual({ ok: true });
    expect(validateSession(FREE, { ...BASE, visibility: "private", waivesPreRegistration: true })).toEqual({
      ok: false,
      error: "invalid_input",
      fields: { waivesPreRegistration: expect.any(String) },
    });
  });

  it("RN-ENC-05: serviço regulado não tem sessão pública", () => {
    expect(validateSession(REGULATED, BASE)).toEqual({ ok: false, error: "regulated_service" });
    expect(validateSession(REGULATED, { ...BASE, visibility: "private" })).toEqual({ ok: true });
  });

  it("AD-038: estações só as que atendem o serviço", () => {
    expect(validateSession(FREE, { ...BASE, stations: ["e1", "e2"] })).toEqual({ ok: true });
    expect(validateSession(FREE, { ...BASE, stations: ["e1", "e9"] })).toEqual({
      ok: false,
      error: "invalid_input",
      fields: { stations: expect.any(String) },
    });
  });
});

describe("changeVisibility", () => {
  it("RN-PUB-03: pública vira privada e perde a dispensa", () => {
    const c = freeze({ ...BASE, waivesPreRegistration: true });
    const r = changeVisibility(c, "private", "direct");
    expect(r.ok && r.state).toEqual({ ...BASE, visibility: "private", waivesPreRegistration: false });
    expect(c.waivesPreRegistration).toBe(true);
  });

  it("RN-PUB-03: privada não vira pública em serviço regulado", () => {
    const c = freeze({ ...BASE, visibility: "private" as const });
    expect(changeVisibility(c, "public", "regulated")).toEqual({ ok: false, error: "regulated_service" });
    const r = changeVisibility(c, "public", "direct");
    expect(r.ok && r.state).toEqual({ ...BASE, visibility: "public" });
  });
});

describe("validarSessao: estações que chamam (revisão 2026-11-13)", () => {
  const WITH_STAGES = freeze({
    mode: "direct" as const,
    serviceStations: ["t1", "a1"],
    requiresTriage: true,
    stages: { t1: "triage" as const, a1: "care" as const },
  });

  it("sem estação de atendimento (ou de triagem, se o serviço exige) ninguém seria chamado", () => {
    expect(validateSession(WITH_STAGES, { ...BASE, stations: [] })).toMatchObject({
      ok: false,
      error: "invalid_input",
    });
    expect(validateSession(WITH_STAGES, { ...BASE, stations: ["a1"] })).toEqual({
      ok: false,
      error: "invalid_input",
      fields: { stations: "inclua uma estação de triagem: o serviço exige triagem" },
    });
    expect(validateSession(WITH_STAGES, { ...BASE, stations: ["t1"] }).ok).toBe(false);
    expect(validateSession(WITH_STAGES, { ...BASE, stations: ["t1", "a1"] })).toEqual({ ok: true });
  });

  it("estação repetida é recusada", () => {
    expect(validateSession(FREE, { ...BASE, stations: ["e1", "e1"] })).toEqual({
      ok: false,
      error: "invalid_input",
      fields: { stations: "estação repetida" },
    });
  });
});
