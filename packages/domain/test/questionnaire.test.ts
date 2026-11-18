import { describe, expect, it } from "vitest";
import type { Alarm } from "../src/kinds.ts";
import { alarmOutcome, classify, toggleOption } from "../src/questionnaire.ts";
import { answers, newProblem } from "./fixtures.ts";

describe("classificação de risco (RN-RISCO)", () => {
  it("RN-RISCO-01: qualquer sinal de alarme da Tela 1 é emergência", () => {
    const alarms: Alarm[] = [
      "shortness_of_breath",
      "chest_pain",
      "fainting",
      "one_sided_weakness",
      "bleeding",
      "seizure",
    ];
    for (const alarm of alarms) {
      expect(classify(answers({ alarms: [alarm] }), 30).level, alarm).toBe("emergency");
    }
    expect(classify(answers({ alarms: [] }), 30).level).toBe("routine");
    expect(classify(answers({ alarms: ["self_harm", "chest_pain"] }), 30).level).toBe("emergency");
  });

  it("autolesão é urgente com apoio, e só ela", () => {
    expect(classify(answers({ alarms: ["self_harm"] }), 30)).toMatchObject({
      level: "urgent",
      support: true,
    });
    expect(classify(newProblem("severe"), 30).support).toBe(false);
  });

  it("urgente: problema novo forte, ou gestante com novo moderado", () => {
    expect(classify(newProblem("severe"), 30).level).toBe("urgent");
    expect(classify(newProblem("moderate", { groups: ["pregnant"] }), 30).level).toBe("urgent");
  });

  it("atenção: novo moderado, novo com condição, gestante com novo leve", () => {
    expect(classify(newProblem("moderate"), 30).level).toBe("attention");
    expect(classify(newProblem("mild", { conditions: ["diabetes"] }), 30).level).toBe("attention");
    expect(classify(newProblem("mild", { groups: ["pregnant"] }), 30).level).toBe("attention");
  });

  it("rotina: todo o resto, mesmo com condição quando não é problema novo", () => {
    expect(classify(newProblem("mild"), 30).level).toBe("routine");
    expect(classify(answers({ reason: "follow_up", conditions: ["diabetes"] }), 70).level).toBe("routine");
    expect(classify(answers({ reason: "prescription" }), 30).level).toBe("routine");
  });

  it("a regra que bateu vem junto do nível", () => {
    expect(classify(newProblem("severe"), 30).rule).toBe("Problema novo forte");
  });

  it("limite de idade abaixo de 2 anos: 1 é atenção, 2 é rotina", () => {
    expect(classify(newProblem("mild"), 1).level).toBe("attention");
    expect(classify(newProblem("mild"), 0).level).toBe("attention");
    expect(classify(newProblem("mild"), 2).level).toBe("routine");
  });

  it("limite de idade a partir de 60 anos: 59 é rotina, 60 é atenção", () => {
    expect(classify(newProblem("mild"), 59).level).toBe("routine");
    expect(classify(newProblem("mild"), 60).level).toBe("attention");
  });

  it("a idade só pesa em problema novo", () => {
    expect(classify(answers({ reason: "exam" }), 1).level).toBe("routine");
    expect(classify(answers({ reason: "prescription" }), 80).level).toBe("routine");
  });
});

describe("opções exclusivas do questionário", () => {
  it("'nenhuma' é exclusiva: marcá-la desmarca as outras e vice-versa", () => {
    expect(toggleOption(["diabetes", "asma"], "nenhuma", "nenhuma")).toEqual(["nenhuma"]);
    expect(toggleOption(["nenhuma"], "diabetes", "nenhuma")).toEqual(["diabetes"]);
    expect(toggleOption(["diabetes"], "asma", "nenhuma")).toEqual(["diabetes", "asma"]);
    expect(toggleOption(["diabetes", "asma"], "diabetes", "nenhuma")).toEqual(["asma"]);
  });

  it("não altera a lista recebida", () => {
    const checked = Object.freeze(["diabetes"]) as string[];
    expect(toggleOption(checked, "asma", "nenhuma")).toEqual(["diabetes", "asma"]);
    expect(checked).toEqual(["diabetes"]);
  });
});

describe("alarmOutcome (tela 1)", () => {
  it("RN-RISCO-02/06: alarme é emergência; só autolesão é apoio; sem alarme, segue", () => {
    expect(alarmOutcome(["chest_pain", "self_harm"])).toBe("emergency");
    expect(alarmOutcome(["self_harm"])).toBe("support");
    expect(alarmOutcome([])).toBeNull();
  });
});
