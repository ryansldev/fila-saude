import { describe, expect, test } from "vitest";
import { cpfSchema, cpfValido, normalizarCpf } from "../cpf";

// 529.982.247-25 é um CPF válido (dígitos verificadores 2 e 5).
describe("cpf", () => {
  test("RN-ID-01: CPF válido com e sem máscara", () => {
    expect(cpfValido("52998224725")).toBe(true);
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725");
    expect(cpfSchema.parse("529.982.247-25")).toBe("52998224725");
    expect(cpfSchema.safeParse("529.982.247-25").success).toBe(true);
  });

  test("RN-ID-01: dígito verificador errado (1º e 2º) é recusado", () => {
    expect(cpfValido("52998224735")).toBe(false); // 1º errado
    expect(cpfValido("52998224724")).toBe(false); // 2º errado
    const r = cpfSchema.safeParse("52998224724");
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("cpf_invalido");
  });

  test("RN-ID-01: 10 e 12 dígitos recusados; 11 iguais recusados", () => {
    expect(cpfValido("5299822472")).toBe(false);
    expect(cpfValido("529982247250")).toBe(false);
    expect(cpfValido("11111111111")).toBe(false);
    expect(cpfValido("00000000000")).toBe(false);
    expect(cpfSchema.safeParse("11111111111").success).toBe(false);
  });
});
