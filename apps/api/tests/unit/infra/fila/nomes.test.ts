import { primeiroNome } from "infra/fila/nomes";
import { describe, expect, it } from "vitest";

describe("primeiroNome (chips da fila da estação)", () => {
  it("só o primeiro nome, sem espaços", () => {
    expect(primeiroNome("  Ana   Souza ")).toBe("Ana");
    expect(primeiroNome("Bruno")).toBe("Bruno");
  });
  it("vazio continua vazio", () => {
    expect(primeiroNome("")).toBe("");
    expect(primeiroNome("   ")).toBe("");
  });
});
