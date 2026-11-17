import { describe, expect, it } from "vitest";
import { dataIso, missingInLogin, otherPersonError, registrationError } from "@/lib/validation";

const ok = {
  name: "Ana Souza",
  cpf: "529.982.247-25",
  birthDate: "15/06/1990",
  phone: "(11) 98765-4321",
  email: "ana@x.com",
  password: "segredo12",
};

describe("validação dos formulários do app (revisão 2026-11-13)", () => {
  it("dataIso converte só datas reais", () => {
    expect(dataIso("15/06/1990")).toBe("1990-06-15");
    expect(dataIso("31/02/2020")).toBe("");
    expect(dataIso("1/2/90")).toBe("");
  });

  it("cadastro: cada campo com a sua mensagem; tudo certo, nenhum erro", () => {
    expect(registrationError(ok)).toEqual({});
    expect(registrationError({ ...ok, cpf: "123.456.789-00" })).toEqual({ cpf: "CPF inválido. confira os números." });
    expect(registrationError({ ...ok, cpf: "111.111.111-11" }).cpf).toBeDefined();
    expect(registrationError({ ...ok, birthDate: "31/02/2020" }).birthDate).toBe("data inválida. use dd/mm/aaaa.");
    expect(registrationError({ ...ok, birthDate: "01/01/2999" }).birthDate).toBe("a data não pode ser no futuro.");
    expect(registrationError({ ...ok, phone: "1234" }).phone).toBe("celular com DDD, só números.");
    expect(registrationError({ ...ok, email: "ana@" }).email).toBe("e-mail inválido.");
    expect(registrationError({ ...ok, password: "curta" }).password).toBe(
      "a senha precisa de pelo menos 8 caracteres.",
    );
    expect(registrationError({ ...ok, name: "  A " }).name).toBe("escreva o nome completo.");
  });

  it("outra pessoa: CPF opcional mas válido quando preenchido", () => {
    const other = { name: "Bia Reis", birthDate: "03/03/2018", cpf: "" };
    expect(otherPersonError(other)).toEqual({});
    expect(otherPersonError({ ...other, cpf: "12345678900" }).cpf).toBe("CPF inválido. confira os números.");
    expect(otherPersonError({ ...other, birthDate: "03/03/2999" }).birthDate).toBeDefined();
  });

  it("outra pessoa com o CPF do dono da conta: já avisa, antes de ir ao servidor", () => {
    const other = { name: "João Souza", birthDate: "01/02/2015", cpf: "529.982.247-25" };
    expect(otherPersonError(other, "52998224725").cpf).toBe('esse é o seu CPF. para você, escolha "para mim".');
    expect(otherPersonError(other, "11144477735")).toEqual({});
    expect(otherPersonError(other, undefined)).toEqual({});
  });
});

describe("entrar: o que falta em cada campo", () => {
  it("diz no campo o que falta, em vez de apagar o botão", () => {
    expect(missingInLogin("", "")).toEqual({ cpf: "digite o CPF.", password: "digite a senha." });
    expect(missingInLogin("  ", "x")).toEqual({ cpf: "digite o CPF." });
    expect(missingInLogin("111.111.111-11", "x")).toEqual({ cpf: "CPF inválido. confira os números." });
    expect(missingInLogin("529.982.247-25", "")).toEqual({ password: "digite a senha." });
    expect(missingInLogin("529.982.247-25", "x")).toEqual({});
  });
});
