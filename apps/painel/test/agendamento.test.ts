import { describe, expect, it } from "vitest";
import { quandoNoFuso, rotuloDoRisco, situacaoDoAlocado, textoDasVagas } from "@/lib/agendamento";
import { menuDoPainel } from "@/lib/navegacao";

const FUSO = "America/Sao_Paulo";

describe("agendamento no painel (fatia 4)", () => {
  it("menu: quem agenda vê 'Agendamento' (e não mais 'Em breve')", () => {
    expect(menuDoPainel([{ perfil: "agendar", unidadeId: "u1" }]).map((i) => i.rotulo)).toEqual(["Agendamento"]);
  });

  it("data e hora no fuso da unidade, com o dia da semana", () => {
    // 2026-11-18 11:00Z = 08:00 em São Paulo (quarta-feira).
    expect(quandoNoFuso("2026-11-18T11:00:00.000Z", FUSO)).toBe("qua., 18/11 às 08:00");
  });

  it("vagas: ocupadas de quantas; sem limite diz 'sem limite'", () => {
    expect(textoDasVagas(2, 5)).toBe("2 de 5 vagas");
    expect(textoDasVagas(3, null)).toBe("3 alocados · sem limite");
  });

  it("RN-CONF-03: situação do alocado; sem resposta depois do prazo fica destacada", () => {
    expect(situacaoDoAlocado({ estado: "alocada", destacada: false })).toEqual({
      rotulo: "Aguardando resposta",
      tom: "neutro",
    });
    expect(situacaoDoAlocado({ estado: "alocada", destacada: true })).toEqual({
      rotulo: "Sem resposta: ligar",
      tom: "alerta",
    });
    expect(situacaoDoAlocado({ estado: "confirmada", destacada: false })).toEqual({ rotulo: "Confirmou", tom: "ok" });
    expect(situacaoDoAlocado({ estado: "na_fila", destacada: false }).rotulo).toBe("Na fila");
  });

  it("RN-RISCO-01: o risco diz se é sugerido pelo app ou confirmado pela triagem", () => {
    expect(rotuloDoRisco({ nivel: "urgente", confirmado: false })).toBe("Urgente · sugerido pelo app");
    expect(rotuloDoRisco({ nivel: "atencao", confirmado: true })).toBe("Atenção · confirmado");
  });
});
