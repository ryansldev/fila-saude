import { describe, expect, it } from "vitest";
import { dayKey, daysWithCare, longDay, monthGrid, monthYear, validDay } from "@/lib/days";

// 16/11/2026, segunda, 10h em Brasília.
const NOW = Date.parse("2026-11-16T13:00:00Z");

describe("dias da faixa da unidade", () => {
  it("a chave é o dia em Brasília, mesmo perto da meia-noite UTC", () => {
    expect(dayKey("2026-11-16T18:00:00Z")).toBe("2026-11-16");
    // 22h30 de 16/11 em Brasília = 01h30 UTC de 17/11.
    expect(dayKey("2026-11-17T01:30:00Z")).toBe("2026-11-16");
  });

  it("um botão por dia com atendimento, em ordem, sem repetir", () => {
    const days = daysWithCare(
      ["2026-11-25T11:00:00Z", "2026-11-16T18:00:00Z", "2026-11-16T12:00:00Z", "2026-11-17T11:00:00Z"],
      NOW,
    );
    expect(days.map((d) => [d.key, d.top, d.day])).toEqual([
      ["2026-11-16", "hoje", "16"],
      ["2026-11-17", "amanhã", "17"],
      ["2026-11-25", "qua", "25"],
    ]);
    expect(days[0]?.monthYear).toBe("novembro de 2026");
  });

  it("mês e ano por extenso, na virada do ano também", () => {
    expect(monthYear("2026-12-15")).toBe("dezembro de 2026");
    expect(monthYear("2027-01-11")).toBe("janeiro de 2027");
    expect(longDay("2026-11-25")).toBe("quarta, 25 de novembro");
  });

  it("grade do mês de domingo a sábado, com os dias marcados", () => {
    const grid = monthGrid(2026, 11, new Set(["2026-11-16", "2026-11-25"]), "2026-11-16");
    // 1/11/2026 é domingo: a primeira semana começa nele.
    expect(grid[0]?.[0]).toMatchObject({ day: 1, key: "2026-11-01", has: false });
    expect(grid[2]?.[1]).toMatchObject({ day: 16, has: true, today: true });
    expect(
      grid
        .flat()
        .filter((c) => c?.has)
        .map((c) => c?.day),
    ).toEqual([16, 25]);
    expect(grid.every((s) => s.length === 7)).toBe(true);
    // Janeiro de 2027 começa numa sexta: cinco vazios antes.
    const jan = monthGrid(2027, 1, new Set(), "2026-11-16");
    expect(jan[0]?.slice(0, 5)).toEqual([null, null, null, null, null]);
    expect(jan[0]?.[5]).toMatchObject({ day: 1 });
  });

  it("dia escolhido que sumiu volta ao primeiro com atendimento", () => {
    const days = daysWithCare(["2026-11-16T18:00:00Z", "2026-11-25T11:00:00Z"], NOW);
    expect(validDay("2026-11-25", days)).toBe("2026-11-25");
    expect(validDay("2026-11-18", days)).toBe("2026-11-16");
    expect(validDay(null, days)).toBe("2026-11-16");
    expect(validDay("2026-11-18", [])).toBeNull();
  });
});
