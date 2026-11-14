import { describe, expect, it } from "vitest";
import { CORES_DA_TRIAGEM, corDoNivel, precisaClassificar, textoDaPrioridade } from "@/lib/triagem";

describe("triagem na estação (fatia 3)", () => {
  it("H1: quatro cores do ACCR, da mais grave para a mais leve", () => {
    expect(CORES_DA_TRIAGEM.map((c) => [c.cor, c.nivel])).toEqual([
      ["vermelho", "emergencia"],
      ["amarelo", "urgente"],
      ["verde", "atencao"],
      ["azul", "rotina"],
    ]);
    expect(corDoNivel("atencao").rotulo).toBe("Verde");
  });

  it("H3: na triagem, com alguém chamado, Finalizar e Chamar próximo pedem a cor", () => {
    expect(precisaClassificar("triagem", true, null)).toBe(true);
    expect(precisaClassificar("triagem", true, "rotina")).toBe(false);
    expect(precisaClassificar("triagem", false, null)).toBe(false);
    expect(precisaClassificar("atendimento", true, null)).toBe(false);
  });

  it("prioridade declarada em português; sem grupos, 'Nenhuma'", () => {
    expect(textoDaPrioridade(["idoso80", "colo"])).toBe("80 anos ou mais, criança de colo");
    expect(textoDaPrioridade([])).toBe("Nenhuma");
  });
});
