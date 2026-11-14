import { describe, expect, it } from "vitest";
import { diaCurto, ehHoje, hora } from "@/lib/datas";

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
