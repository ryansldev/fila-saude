import { describe, expect, it } from "vitest";
import { firstName, properName, sameName, samePerson } from "../src/index.ts";

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

describe("mesma pessoa (app, API e domínio usam a mesma regra)", () => {
  it("mesmo nome: sem diferença de maiúsculas, acentos e espaços", () => {
    expect(sameName("  João   da Silva ", "joao da silva")).toBe(true);
    expect(sameName("João Silva", "João Souza")).toBe(false);
    expect(sameName("", "")).toBe(false);
  });

  it("mesma pessoa (RN-LE-02): CPF quando os dois têm; senão nome e nascimento", () => {
    const joao = { name: "João da Silva", birthDate: "2010-01-02", cpf: "529.982.247-25" };
    expect(samePerson(joao, { ...joao, name: "Outro Nome", cpf: "52998224725" })).toBe(true);
    expect(samePerson(joao, { ...joao, cpf: "111.444.777-35" })).toBe(false);
    expect(samePerson(joao, { name: "joao da silva", birthDate: "2010-01-02", cpf: null })).toBe(true);
    expect(samePerson(joao, { name: "joao da silva", birthDate: "2010-01-03" })).toBe(false);
    expect(samePerson(joao, { name: "joao da silva", birthDate: "" })).toBe(false);
  });
});
