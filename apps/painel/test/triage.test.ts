import { describe, expect, it } from "vitest";
import { canRefer, levelColor, needsClassify, priorityText, TRIAGE_COLORS } from "@/lib/triage";

describe("triagem na estação (fatia 3)", () => {
  it("AD-058: as cinco cores do Manchester, da mais grave para a mais leve, com o tempo-alvo", () => {
    expect(TRIAGE_COLORS.map((c) => [c.color, c.level, c.targetTime])).toEqual([
      ["red", "emergency", "imediato"],
      ["orange", "very_urgent", "até 10 min"],
      ["yellow", "urgent", "até 60 min"],
      ["green", "attention", "até 120 min"],
      ["blue", "routine", "até 240 min"],
    ]);
    expect(levelColor("attention").label).toBe("Verde");
    expect(levelColor("very_urgent").description).toBe("Muito urgente");
  });

  it("H3: na triagem, com alguém chamado, Finalizar e Chamar próximo pedem a cor", () => {
    expect(needsClassify("triage", true, null)).toBe(true);
    expect(needsClassify("triage", true, "routine")).toBe(false);
    expect(needsClassify("triage", false, null)).toBe(false);
    expect(needsClassify("care", true, null)).toBe(false);
  });

  it("prioridade declarada em português; sem grupos, 'Nenhuma'", () => {
    expect(priorityText(["elderly80", "infant"])).toBe("80 anos ou mais, criança de colo");
    expect(priorityText([])).toBe("Nenhuma");
  });

  it("AD-059: 'encaminhar à emergência' só aparece com vermelho escolhido", () => {
    expect(canRefer("emergency")).toBe(true);
    expect(canRefer("very_urgent")).toBe(false);
    expect(canRefer(null)).toBe(false);
  });
});
