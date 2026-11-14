import { describe, expect, it } from "vitest";
import { mascararCep, mascararCpf, mascararData, mascararTelefone, soDigitos } from "../mascaras.ts";

describe("máscaras de digitação (revisão 2026-11-13)", () => {
  it("CPF: pontos e traço conforme digita; nada além de 11 dígitos; colar com ou sem pontuação", () => {
    expect(mascararCpf("529")).toBe("529");
    expect(mascararCpf("5299")).toBe("529.9");
    expect(mascararCpf("5299822")).toBe("529.982.2");
    expect(mascararCpf("52998224725")).toBe("529.982.247-25");
    expect(mascararCpf("529.982.247-2599")).toBe("529.982.247-25");
    expect(mascararCpf("abc")).toBe("");
  });

  it("data: barras automáticas, até dd/mm/aaaa", () => {
    expect(mascararData("1")).toBe("1");
    expect(mascararData("150")).toBe("15/0");
    expect(mascararData("15061990")).toBe("15/06/1990");
    expect(mascararData("15/06/19901")).toBe("15/06/1990");
  });

  it("celular e fixo com DDD", () => {
    expect(mascararTelefone("11")).toBe("(11");
    expect(mascararTelefone("119")).toBe("(11) 9");
    expect(mascararTelefone("1198765432")).toBe("(11) 9876-5432");
    expect(mascararTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(mascararTelefone("119876543210")).toBe("(11) 98765-4321");
  });

  it("CEP e só dígitos", () => {
    expect(mascararCep("01001000")).toBe("01001-000");
    expect(mascararCep("0100")).toBe("0100");
    expect(soDigitos("(11) 9-8")).toBe("1198");
  });
});
