import { describe, expect, it } from "vitest";
import { chaveDoDia, diaPorExtenso, diasComAtendimento, diaValido, gradeDoMes, mesAno } from "@/lib/dias";

// 16/11/2026, segunda, 10h em Brasília.
const AGORA = Date.parse("2026-11-16T13:00:00Z");

describe("dias da faixa da unidade", () => {
  it("a chave é o dia em Brasília, mesmo perto da meia-noite UTC", () => {
    expect(chaveDoDia("2026-11-16T18:00:00Z")).toBe("2026-11-16");
    // 22h30 de 16/11 em Brasília = 01h30 UTC de 17/11.
    expect(chaveDoDia("2026-11-17T01:30:00Z")).toBe("2026-11-16");
  });

  it("um botão por dia com atendimento, em ordem, sem repetir", () => {
    const dias = diasComAtendimento(
      ["2026-11-25T11:00:00Z", "2026-11-16T18:00:00Z", "2026-11-16T12:00:00Z", "2026-11-17T11:00:00Z"],
      AGORA,
    );
    expect(dias.map((d) => [d.chave, d.topo, d.dia])).toEqual([
      ["2026-11-16", "hoje", "16"],
      ["2026-11-17", "amanhã", "17"],
      ["2026-11-25", "qua", "25"],
    ]);
    expect(dias[0]?.mesAno).toBe("novembro de 2026");
  });

  it("mês e ano por extenso, na virada do ano também", () => {
    expect(mesAno("2026-12-15")).toBe("dezembro de 2026");
    expect(mesAno("2027-01-11")).toBe("janeiro de 2027");
    expect(diaPorExtenso("2026-11-25")).toBe("quarta, 25 de novembro");
  });

  it("grade do mês de domingo a sábado, com os dias marcados", () => {
    const grade = gradeDoMes(2026, 11, new Set(["2026-11-16", "2026-11-25"]), "2026-11-16");
    // 1/11/2026 é domingo: a primeira semana começa nele.
    expect(grade[0]?.[0]).toMatchObject({ dia: 1, chave: "2026-11-01", tem: false });
    expect(grade[2]?.[1]).toMatchObject({ dia: 16, tem: true, hoje: true });
    expect(
      grade
        .flat()
        .filter((c) => c?.tem)
        .map((c) => c?.dia),
    ).toEqual([16, 25]);
    expect(grade.every((s) => s.length === 7)).toBe(true);
    // Janeiro de 2027 começa numa sexta: cinco vazios antes.
    const jan = gradeDoMes(2027, 1, new Set(), "2026-11-16");
    expect(jan[0]?.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(jan[0]?.[5]).toMatchObject({ dia: 1 });
  });

  it("dia escolhido que sumiu volta ao primeiro com atendimento", () => {
    const dias = diasComAtendimento(["2026-11-16T18:00:00Z", "2026-11-25T11:00:00Z"], AGORA);
    expect(diaValido("2026-11-25", dias)).toBe("2026-11-25");
    expect(diaValido("2026-11-18", dias)).toBe("2026-11-16");
    expect(diaValido(null, dias)).toBe("2026-11-16");
    expect(diaValido("2026-11-18", [])).toBeNull();
  });
});
