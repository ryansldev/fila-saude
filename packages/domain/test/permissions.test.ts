import { describe, expect, it } from "vitest";
import { type Action, can, cellText, conditions, MATRIX, type Profile } from "../src/permissions.ts";
import { canGivePriority } from "../src/priority.ts";
import { MATRIX_PROFILES, readMatrix } from "./specs-tables.ts";

describe("permissoes (RN-PERF)", () => {
  it("RN-PERF-01: toda linha da matriz da spec está nos dados", () => {
    const fromSpec = readMatrix();
    expect(fromSpec.length).toBeGreaterThan(0);
    expect(MATRIX.map((l) => l.text)).toEqual(fromSpec.map((l) => l.text));
    fromSpec.forEach((row, i) => {
      const data = MATRIX[i]?.profiles ?? {};
      MATRIX_PROFILES.forEach((profile, col) => {
        expect(cellText(data[profile]), `${row.text} / ${profile}`).toBe(row.cells[col] ?? "");
      });
      expect(Object.keys(data).every((p) => (MATRIX_PROFILES as readonly string[]).includes(p))).toBe(true);
    });
    expect(new Set(MATRIX.map((l) => l.action)).size).toBe(MATRIX.length);
  });

  it("RN-PERF-01: a matriz é imutável", () => {
    expect(Object.isFrozen(MATRIX)).toBe(true);
    expect(MATRIX.every((l) => Object.isFrozen(l) && Object.isFrozen(l.profiles))).toBe(true);
  });

  it("RN-RISCO-04: recepção não dá prioridade a quem já está na fila", () => {
    expect(can(["reception"], "give_priority")).toBe(true);
    expect(can(["nurse"], "give_priority")).toBe(false);
    expect(canGivePriority("desk_addition")).toBe(true);
    expect(canGivePriority("first_attendance_without_app")).toBe(true);
    expect(canGivePriority("already_in_queue")).toBe(false);
    // conferir ou tirar segue permitido a qualquer momento
    expect(can(["reception"], "verify_or_remove_priority")).toBe(true);
  });

  it("RN-PERF-01: perfil acumulado soma permissões", () => {
    const actions = (profiles: Profile[]) => MATRIX.filter((l) => can(profiles, l.action)).map((l) => l.action);
    const sum = new Set<Action>([...actions(["scheduler"]), ...actions(["nurse"])]);
    expect(new Set(actions(["scheduler", "nurse"]))).toEqual(sum);
    expect(can(["scheduler"], "operate_calls")).toBe(false);
    expect(can(["scheduler", "care"], "operate_calls")).toBe(true);
    expect(can([], "allocate_confirm_refuse_for_patient")).toBe(false);
    expect(can(["reception", "unit_manager"], "print_day_list")).toBe(true);
  });

  it("RN-PERF-01: condicoes distingue concessão livre de condicionada", () => {
    expect(conditions(["unit_manager"], "open_cancel_close_session")).toBe("free");
    expect(conditions(["patient"], "view_documents")).toEqual(["próprios"]);
    expect(conditions(["patient"], "view_life_risk_answer")).toEqual(["própria"]);
    expect(conditions(["reception"], "view_life_risk_answer")).toEqual(["só ao aplicar no balcão"]);
    expect(conditions(["nursing_technician"], "operate_calls")).toEqual(["acolhimento na triagem"]);
    expect(conditions(["patient", "reception"], "view_life_risk_answer")).toEqual([
      "própria",
      "só ao aplicar no balcão",
    ]);
    // um ✓ simples entre os perfis torna a concessão livre
    expect(conditions(["patient", "scheduler"], "view_documents")).toBe("free");
    expect(conditions(["sms_management"], "view_documents")).toBeNull();
    expect(conditions([], "validate_referral")).toBeNull();
    for (const l of MATRIX) {
      for (const p of MATRIX_PROFILES) expect(conditions([p], l.action) !== null).toBe(can([p], l.action));
    }
  });

  it("RN-PERF-05 (Cofen 661/2021): classificar risco é só do enfermeiro; o técnico acolhe na triagem sem classificar", () => {
    expect(can(["nurse"], "confirm_risk_level")).toBe(true);
    expect(can(["nursing_technician"], "confirm_risk_level")).toBe(false);
    expect(can(["scheduler"], "confirm_risk_level")).toBe(false);
    expect(can(["nursing_technician"], "operate_calls")).toBe(true);
  });

  it("RN-PERF-04: cadastrar a equipe é da gestão SMS e do gerente da UBS; unidades e regras, só da SMS", () => {
    expect(can(["sms_management"], "register_staff")).toBe(true);
    expect(conditions(["unit_manager"], "register_staff")).toEqual(["da própria unidade, sem função de gestão"]);
    expect(can(["unit_manager"], "create_units_and_rules")).toBe(false);
    expect(can(["sms_regulation"], "register_regulated")).toBe(true);
  });
});
