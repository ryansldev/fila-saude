import { describe, expect, it } from "vitest";
import { CORES_DA_TRIAGEM, corDoNivel, precisaClassificar, textoDaPrioridade } from "@/lib/triagem";

describe("triagem na estação (fatia 3)", () => {
  it("AD-058: as cinco cores do Manchester, da mais grave para a mais leve, com o tempo-alvo", () => {
    expect(CORES_DA_TRIAGEM.map((c) => [c.cor, c.nivel, c.tempoAlvo])).toEqual([
      ["vermelho", "emergencia", "imediato"],
      ["laranja", "muito_urgente", "até 10 min"],
      ["amarelo", "urgente", "até 60 min"],
      ["verde", "atencao", "até 120 min"],
      ["azul", "rotina", "até 240 min"],
    ]);
    expect(corDoNivel("atencao").rotulo).toBe("Verde");
    expect(corDoNivel("muito_urgente").descricao).toBe("Muito urgente");
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
