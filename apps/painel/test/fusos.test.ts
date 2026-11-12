import { describe, expect, it } from "vitest";
import { FUSOS_DO_BRASIL, gruposDeFusos, rotuloDoFuso } from "@/lib/formularios/fusos";

const AGORA = Date.parse("2026-11-12T12:00:00Z");

describe("fusos", () => {
  it("o select tem o grupo do Brasil primeiro e depois todos os fusos IANA", () => {
    const grupos = gruposDeFusos(AGORA);
    expect(grupos.map((g) => g.grupo)).toEqual(["Brasil", "Todos os fusos"]);
    expect(grupos[0]?.fusos.map((f) => f.fuso)).toEqual(FUSOS_DO_BRASIL.map((f) => f.fuso));
    const todos = grupos[1]?.fusos.map((f) => f.fuso) ?? [];
    expect(todos.length).toBeGreaterThan(300);
    expect(todos).toEqual(expect.arrayContaining(["Europe/Lisbon", "Asia/Tokyo", "America/Cuiaba", "Africa/Luanda"]));
  });

  it("todo fuso do select é um fuso IANA válido", () => {
    for (const g of gruposDeFusos(AGORA)) {
      for (const { fuso } of g.fusos) expect(() => new Intl.DateTimeFormat("pt-BR", { timeZone: fuso })).not.toThrow();
    }
  });

  it("o rótulo mostra a cidade e o deslocamento UTC", () => {
    expect(rotuloDoFuso("Asia/Tokyo", AGORA)).toBe("Asia/Tokyo (UTC+9)");
    expect(rotuloDoFuso("America/Sao_Paulo", AGORA)).toMatch(/Brasília.*UTC−3/);
    expect(rotuloDoFuso("Asia/Kolkata", AGORA)).toBe("Asia/Kolkata (UTC+5:30)");
  });
});
