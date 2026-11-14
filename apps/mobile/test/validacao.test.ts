import { describe, expect, it } from "vitest";
import { dataIso, erroDaOutraPessoa, erroDoCadastro } from "@/lib/validacao";

const ok = {
  nome: "Ana Souza",
  cpf: "529.982.247-25",
  nascimento: "15/06/1990",
  telefone: "(11) 98765-4321",
  email: "ana@x.com",
  senha: "segredo12",
};

describe("validação dos formulários do app (revisão 2026-11-13)", () => {
  it("dataIso converte só datas reais", () => {
    expect(dataIso("15/06/1990")).toBe("1990-06-15");
    expect(dataIso("31/02/2020")).toBe("");
    expect(dataIso("1/2/90")).toBe("");
  });

  it("cadastro: cada campo com a sua mensagem; tudo certo, nenhum erro", () => {
    expect(erroDoCadastro(ok)).toEqual({});
    expect(erroDoCadastro({ ...ok, cpf: "123.456.789-00" })).toEqual({ cpf: "CPF inválido. confira os números." });
    expect(erroDoCadastro({ ...ok, cpf: "111.111.111-11" }).cpf).toBeDefined();
    expect(erroDoCadastro({ ...ok, nascimento: "31/02/2020" }).nascimento).toBe("data inválida. use dd/mm/aaaa.");
    expect(erroDoCadastro({ ...ok, nascimento: "01/01/2999" }).nascimento).toBe("a data não pode ser no futuro.");
    expect(erroDoCadastro({ ...ok, telefone: "1234" }).telefone).toBe("celular com DDD, só números.");
    expect(erroDoCadastro({ ...ok, email: "ana@" }).email).toBe("e-mail inválido.");
    expect(erroDoCadastro({ ...ok, senha: "curta" }).senha).toBe("a senha precisa de pelo menos 8 caracteres.");
    expect(erroDoCadastro({ ...ok, nome: "  A " }).nome).toBe("escreva o nome completo.");
  });

  it("outra pessoa: CPF opcional mas válido quando preenchido", () => {
    const outra = { nome: "Bia Reis", nascimento: "03/03/2018", cpf: "" };
    expect(erroDaOutraPessoa(outra)).toEqual({});
    expect(erroDaOutraPessoa({ ...outra, cpf: "12345678900" }).cpf).toBe("CPF inválido. confira os números.");
    expect(erroDaOutraPessoa({ ...outra, nascimento: "03/03/2999" }).nascimento).toBeDefined();
  });

  it("outra pessoa com o CPF do dono da conta: já avisa, antes de ir ao servidor", () => {
    const outra = { nome: "João Souza", nascimento: "01/02/2015", cpf: "529.982.247-25" };
    expect(erroDaOutraPessoa(outra, "52998224725").cpf).toBe('esse é o seu CPF. para você, escolha "para mim".');
    expect(erroDaOutraPessoa(outra, "11144477735")).toEqual({});
    expect(erroDaOutraPessoa(outra, undefined)).toEqual({});
  });
});
