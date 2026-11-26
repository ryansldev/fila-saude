import { describe, expect, it } from "vitest";
import { dayGreeting, dayParts, hour, isToday, sessionHours, shortDay } from "@/lib/dates";

describe("cumprimento do Dr. pelo horário", () => {
  it("bom dia de manhã, boa tarde à tarde, boa noite à noite e de madrugada", () => {
    // 9h, 15h e 21h em Brasília (UTC−3).
    expect(dayGreeting(Date.parse("2026-11-13T12:00:00.000Z"))).toBe("bom dia");
    expect(dayGreeting(Date.parse("2026-11-13T18:00:00.000Z"))).toBe("boa tarde");
    expect(dayGreeting(Date.parse("2026-11-14T00:00:00.000Z"))).toBe("boa noite");
    expect(dayGreeting(Date.parse("2026-11-13T06:00:00.000Z"))).toBe("boa noite"); // 3h
  });
});

describe("bloco de data dos cartões", () => {
  const now = Date.parse("2026-11-13T12:00:00.000Z"); // sexta, 13/11, 9h em Brasília
  it("dia do mês grande, mês curto; em cima, hoje, amanhã ou o dia da semana", () => {
    expect(dayParts("2026-11-13T17:00:00.000Z", now)).toEqual({ top: "hoje", day: "13", month: "nov" });
    expect(dayParts("2026-11-14T11:00:00.000Z", now)).toEqual({ top: "amanhã", day: "14", month: "nov" });
    expect(dayParts("2026-11-18T11:00:00.000Z", now)).toEqual({ top: "qua", day: "18", month: "nov" });
    // 23h30 de 30/11 em Brasília ainda é novembro.
    expect(dayParts("2026-12-01T02:30:00.000Z", now)).toEqual({ top: "seg", day: "30", month: "nov" });
  });
});

describe("datas como no design do app", () => {
  it("dia da semana e data curta, em minúsculas, no fuso da unidade", () => {
    expect(shortDay("2026-11-12T11:00:00.000Z")).toBe("quinta, 12/11");
    expect(shortDay("2026-11-13T02:30:00.000Z")).toBe("quinta, 12/11");
  });

  it("hora cheia sem minutos; com minutos, 7h30", () => {
    expect(hour("2026-11-12T10:00:00.000Z")).toBe("7h");
    expect(hour("2026-11-12T10:30:00.000Z")).toBe("7h30");
  });
});

describe("hoje no fuso da unidade", () => {
  it("só é hoje se o dia em Brasília é o mesmo", () => {
    const now = Date.parse("2026-11-13T12:00:00.000Z");
    expect(isToday("2026-11-13T22:00:00.000Z", now)).toBe(true);
    expect(isToday("2026-11-14T02:30:00.000Z", now)).toBe(true); // 23h30 de 13/11 em Brasília
    expect(isToday("2026-11-14T03:30:00.000Z", now)).toBe(false);
    expect(isToday("2026-11-20T12:00:00.000Z", now)).toBe(false);
  });
});

describe("horário em faixas (RN-SES-06)", () => {
  it("uma faixa: 8h às 12h; duas: cada faixa, com o intervalo de fora", () => {
    expect(sessionHours({ start: "2026-11-15T11:00:00.000Z", end: "2026-11-15T15:00:00.000Z", breaks: [] })).toBe(
      "8h às 12h",
    );
    expect(
      sessionHours({
        start: "2026-11-15T11:00:00.000Z",
        end: "2026-11-15T20:30:00.000Z",
        breaks: [{ start: "2026-11-15T15:00:00.000Z", end: "2026-11-15T16:00:00.000Z" }],
      }),
    ).toBe("8h às 12h e 13h às 17h30");
  });
});
