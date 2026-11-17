import { describe, expect, it } from "vitest";
import { nomeProprio, primeiroNome } from "../src/index.ts";

describe("nomes de pessoas (regra do projeto: primeira letra maiúscula)", () => {
  it("nome próprio com conectivos em minúsculas", () => {
    expect(nomeProprio("maria DA silva")).toBe("Maria da Silva");
    expect(nomeProprio("  ana   souza ")).toBe("Ana Souza");
  });

  it("primeiro nome, já com maiúscula; vazio fica vazio", () => {
    expect(primeiroNome("ana souza")).toBe("Ana");
    expect(primeiroNome("bRUNO lima")).toBe("Bruno");
    expect(primeiroNome("")).toBe("");
  });
});
