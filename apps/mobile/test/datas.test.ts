import { describe, expect, it } from "vitest";
import { cumprimentoDoDia, diaCurto, ehHoje, hora, janelaDoAtendimento, partesDoDia } from "@/lib/datas";

describe("cumprimento do Dr. pelo horário", () => {
  it("bom dia de manhã, boa tarde à tarde, boa noite à noite e de madrugada", () => {
    // 9h, 15h e 21h em Brasília (UTC−3).
    expect(cumprimentoDoDia(Date.parse("2026-11-13T12:00:00.000Z"))).toBe("bom dia");
    expect(cumprimentoDoDia(Date.parse("2026-11-13T18:00:00.000Z"))).toBe("boa tarde");
    expect(cumprimentoDoDia(Date.parse("2026-11-14T00:00:00.000Z"))).toBe("boa noite");
    expect(cumprimentoDoDia(Date.parse("2026-11-13T06:00:00.000Z"))).toBe("boa noite"); // 3h
  });
});

describe("bloco de data dos cartões", () => {
  const agora = Date.parse("2026-11-13T12:00:00.000Z"); // sexta, 13/11, 9h em Brasília
  it("dia do mês grande, mês curto; em cima, hoje, amanhã ou o dia da semana", () => {
    expect(partesDoDia("2026-11-13T17:00:00.000Z", agora)).toEqual({ topo: "hoje", dia: "13", mes: "nov" });
    expect(partesDoDia("2026-11-14T11:00:00.000Z", agora)).toEqual({ topo: "amanhã", dia: "14", mes: "nov" });
    expect(partesDoDia("2026-11-18T11:00:00.000Z", agora)).toEqual({ topo: "qua", dia: "18", mes: "nov" });
    // 23h30 de 30/11 em Brasília ainda é novembro.
    expect(partesDoDia("2026-12-01T02:30:00.000Z", agora)).toEqual({ topo: "seg", dia: "30", mes: "nov" });
  });
});

describe("datas como no design do app", () => {
  it("dia da semana e data curta, em minúsculas, no fuso da unidade", () => {
    expect(diaCurto("2026-11-12T11:00:00.000Z")).toBe("quinta, 12/11");
    expect(diaCurto("2026-11-13T02:30:00.000Z")).toBe("quinta, 12/11");
  });

  it("hora cheia sem minutos; com minutos, 7h30", () => {
    expect(hora("2026-11-12T10:00:00.000Z")).toBe("7h");
    expect(hora("2026-11-12T10:30:00.000Z")).toBe("7h30");
  });
});

describe("hoje no fuso da unidade", () => {
  it("só é hoje se o dia em Brasília é o mesmo", () => {
    const agora = Date.parse("2026-11-13T12:00:00.000Z");
    expect(ehHoje("2026-11-13T22:00:00.000Z", agora)).toBe(true);
    expect(ehHoje("2026-11-14T02:30:00.000Z", agora)).toBe(true); // 23h30 de 13/11 em Brasília
    expect(ehHoje("2026-11-14T03:30:00.000Z", agora)).toBe(false);
    expect(ehHoje("2026-11-20T12:00:00.000Z", agora)).toBe(false);
  });
});

describe("quando é o atendimento (cartão, revisão 2026-11-14)", () => {
  const agora = Date.parse("2026-11-14T12:00:00.000Z"); // sábado 9h em Brasília
  it("hoje, amanhã ou o dia; com a faixa de horário", () => {
    expect(janelaDoAtendimento("2026-11-14T17:00:00.000Z", "2026-11-14T21:00:00.000Z", agora)).toBe(
      "hoje, das 14h às 18h",
    );
    expect(janelaDoAtendimento("2026-11-15T11:00:00.000Z", "2026-11-15T15:30:00.000Z", agora)).toBe(
      "amanhã, das 8h às 12h30",
    );
    expect(janelaDoAtendimento("2026-11-18T11:00:00.000Z", "2026-11-18T15:00:00.000Z", agora)).toBe(
      "quarta, 18/11, das 8h às 12h",
    );
  });
});
