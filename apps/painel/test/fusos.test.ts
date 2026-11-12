import { describe, expect, it } from "vitest";
import { FUSOS_DO_BRASIL, opcoesDeFuso, rotuloDoFuso } from "@/lib/formularios/fusos";

const AGORA = Date.parse("2026-11-12T12:00:00Z");

describe("fusos", () => {
  it("o select tem todos os 16 fusos do Brasil e nenhum de fora", () => {
    const fusos = opcoesDeFuso(AGORA).map((o) => o.fuso);
    expect(fusos).toHaveLength(16);
    expect(fusos).toEqual(
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
    expect(fusos.every((f) => FUSOS_DO_BRASIL.some((b) => b.fuso === f))).toBe(true);
  });

  it("ordem: do leste (Noronha) ao oeste (Acre); dentro do mesmo horário, pelo nome", () => {
    const opcoes = opcoesDeFuso(AGORA);
    expect(opcoes[0]?.fuso).toBe("America/Noronha");
    expect(opcoes.at(-1)?.fuso).toMatch(/America\/(Rio_Branco|Eirunepe)/);
  });

  it("todo fuso é um fuso IANA válido", () => {
    for (const { fuso } of FUSOS_DO_BRASIL)
      expect(() => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso })).not.toThrow();
  });

  it("rótulo como nos apps: (GMT-03:00) Horário de Brasília - Cidade", () => {
    expect(rotuloDoFuso("America/Recife", AGORA)).toBe("(GMT-03:00) Horário de Brasília - Recife");
    expect(rotuloDoFuso("America/Sao_Paulo", AGORA)).toBe("(GMT-03:00) Horário de Brasília - São Paulo");
    expect(rotuloDoFuso("America/Cuiaba", AGORA)).toBe("(GMT-04:00) Horário do Amazonas - Cuiabá");
    expect(rotuloDoFuso("America/Rio_Branco", AGORA)).toBe("(GMT-05:00) Horário do Acre - Rio Branco");
    expect(rotuloDoFuso("America/Noronha", AGORA)).toBe("(GMT-02:00) Horário de Fernando de Noronha");
    expect(rotuloDoFuso("Asia/Kolkata", AGORA)).toBe("(GMT+05:30) Asia/Kolkata");
  });
});
