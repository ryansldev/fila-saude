import { describe, expect, it } from "vitest";
import { maskCpf, maskData, maskPhone, maskPostalCode, onlyDigits } from "../masks.ts";

describe("máscaras de digitação (revisão 2026-11-13)", () => {
  it("CPF: pontos e traço conforme digita; nada além de 11 dígitos; colar com ou sem pontuação", () => {
    expect(maskCpf("529")).toBe("529");
    expect(maskCpf("5299")).toBe("529.9");
    expect(maskCpf("5299822")).toBe("529.982.2");
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("529.982.247-2599")).toBe("529.982.247-25");
    expect(maskCpf("abc")).toBe("");
  });

  it("data: barras automáticas, até dd/mm/aaaa", () => {
    expect(maskData("1")).toBe("1");
    expect(maskData("150")).toBe("15/0");
    expect(maskData("15061990")).toBe("15/06/1990");
    expect(maskData("15/06/19901")).toBe("15/06/1990");
  });

  it("celular e fixo com DDD", () => {
    expect(maskPhone("11")).toBe("(11");
    expect(maskPhone("119")).toBe("(11) 9");
    expect(maskPhone("1198765432")).toBe("(11) 9876-5432");
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
    expect(maskPhone("119876543210")).toBe("(11) 98765-4321");
  });

  it("CEP e só dígitos", () => {
    expect(maskPostalCode("01001000")).toBe("01001-000");
    expect(maskPostalCode("0100")).toBe("0100");
    expect(onlyDigits("(11) 9-8")).toBe("1198");
  });
});
