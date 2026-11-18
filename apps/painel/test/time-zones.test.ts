import { describe, expect, it } from "vitest";
import { BRAZIL_TIME_ZONES, timeZoneLabel, timeZoneOptions } from "@/lib/forms/time-zones";

const NOW = Date.parse("2026-11-12T12:00:00Z");

describe("fusos", () => {
  it("o select tem todos os 16 fusos do Brasil e nenhum de fora", () => {
    const timeZones = timeZoneOptions(NOW).map((o) => o.timeZone);
    expect(timeZones).toHaveLength(16);
    expect(timeZones).toEqual(
      expect.arrayContaining([
        "America/Noronha",
        "America/Recife",
        "America/Fortaleza",
        "America/Belem",
        "America/Bahia",
        "America/Maceio",
        "America/Araguaina",
        "America/Sao_Paulo",
        "America/Santarem",
        "America/Cuiaba",
        "America/Campo_Grande",
        "America/Porto_Velho",
        "America/Boa_Vista",
        "America/Manaus",
        "America/Eirunepe",
        "America/Rio_Branco",
      ]),
    );
    expect(timeZones.every((f) => BRAZIL_TIME_ZONES.some((b) => b.timeZone === f))).toBe(true);
  });

  it("ordem: do leste (Noronha) ao oeste (Acre); dentro do mesmo horário, pelo nome", () => {
    const options = timeZoneOptions(NOW);
    expect(options[0]?.timeZone).toBe("America/Noronha");
    expect(options.at(-1)?.timeZone).toMatch(/America\/(Rio_Branco|Eirunepe)/);
  });

  it("todo fuso é um fuso IANA válido", () => {
    for (const { timeZone } of BRAZIL_TIME_ZONES)
      expect(() => new Intl.DateTimeFormat("pt-BR", { timeZone: timeZone })).not.toThrow();
  });

  it("rótulo como nos apps: (GMT-03:00) Horário de Brasília - Cidade", () => {
    expect(timeZoneLabel("America/Recife", NOW)).toBe("(GMT-03:00) Horário de Brasília - Recife");
    expect(timeZoneLabel("America/Sao_Paulo", NOW)).toBe("(GMT-03:00) Horário de Brasília - São Paulo");
    expect(timeZoneLabel("America/Cuiaba", NOW)).toBe("(GMT-04:00) Horário do Amazonas - Cuiabá");
    expect(timeZoneLabel("America/Rio_Branco", NOW)).toBe("(GMT-05:00) Horário do Acre - Rio Branco");
    expect(timeZoneLabel("America/Noronha", NOW)).toBe("(GMT-02:00) Horário de Fernando de Noronha");
    expect(timeZoneLabel("Asia/Kolkata", NOW)).toBe("(GMT+05:30) Asia/Kolkata");
  });
});
