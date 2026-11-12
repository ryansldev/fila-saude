import { describe, expect, it } from "vitest";
import { FUSOS_DO_BRASIL, rotuloDoFuso } from "@/lib/formularios/fusos";

describe("fusos", () => {
  it("o select oferece os fusos do Brasil, com Brasília primeiro", () => {
    expect(FUSOS_DO_BRASIL.map((f) => f.fuso)).toEqual([
      "America/Sao_Paulo",
      "America/Manaus",
      "America/Rio_Branco",
      "America/Noronha",
    ]);
  });
  it("todo fuso do select é um fuso IANA válido", () => {
    for (const { fuso } of FUSOS_DO_BRASIL) expect(() => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso })).not.toThrow();
  });
  it("fuso fora da lista aparece pelo nome", () => {
    expect(rotuloDoFuso("America/Sao_Paulo")).toMatch(/Brasília/);
    expect(rotuloDoFuso("Europe/Lisbon")).toBe("Europe/Lisbon");
  });
});
