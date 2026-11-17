import { describe, expect, it } from "vitest";
import { firstName, properName } from "../src/index.ts";

describe("nomes de pessoas (regra do projeto: primeira letra maiúscula)", () => {
  it("nome próprio com conectivos em minúsculas", () => {
    expect(properName("maria DA silva")).toBe("Maria da Silva");
    expect(properName("  ana   souza ")).toBe("Ana Souza");
  });

  it("primeiro nome, já com maiúscula; vazio fica vazio", () => {
    expect(firstName("ana souza")).toBe("Ana");
    expect(firstName("bRUNO lima")).toBe("Bruno");
    expect(firstName("")).toBe("");
  });
});
