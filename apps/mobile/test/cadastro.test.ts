import { describe, expect, it } from "vitest";
import {
  erroDoPasso,
  PASSOS_DO_CADASTRO,
  passoAnterior,
  passoDoErroDoServidor,
  proximoPasso,
  regraDaSenha,
  resumoDoCadastro,
} from "@/lib/cadastro";

const ok = {
  nome: "Joana Prado",
  cpf: "390.533.447-05",
  nascimento: "10/02/1985",
  telefone: "(11) 98888-7777",
  senha: "segredo123",
  email: "joana@exemplo.com",
};

describe("cadastro, uma pergunta por tela", () => {
  it("as telas em ordem, com o confira no fim", () => {
    expect(PASSOS_DO_CADASTRO).toEqual(["nome", "cpf", "nascimento", "telefone", "senha", "email", "confira"]);
  });

  it("cada tela só olha o seu campo", () => {
    const v = { ...ok, cpf: "111.111.111-11", senha: "curta" };
    expect(erroDoPasso("nome", v)).toBeUndefined();
    expect(erroDoPasso("cpf", v)).toMatch(/CPF/);
    expect(erroDoPasso("senha", v)).toBe("a senha precisa de pelo menos 8 caracteres.");
    expect(erroDoPasso("confira", ok)).toBeUndefined();
  });

  it("continuar avança; depois de corrigir, volta ao confira", () => {
    expect(proximoPasso("nome", false)).toBe("cpf");
    expect(proximoPasso("email", false)).toBe("confira");
    expect(proximoPasso("cpf", true)).toBe("confira");
  });

  it("voltar: a primeira tela sai do cadastro", () => {
    expect(passoAnterior("nome")).toBeNull();
    expect(passoAnterior("cpf")).toBe("nome");
    expect(passoAnterior("confira")).toBe("email");
  });

  it("a regra da senha marca enquanto digita", () => {
    expect(regraDaSenha("1234567")).toEqual({ oitoCaracteres: false });
    expect(regraDaSenha("12345678")).toEqual({ oitoCaracteres: true });
  });

  it("erro do servidor leva à tela do campo", () => {
    expect(passoDoErroDoServidor("cpf_em_uso")).toBe("cpf");
    expect(passoDoErroDoServidor("cpf_invalido")).toBe("cpf");
    expect(passoDoErroDoServidor("email_em_uso")).toBe("email");
    expect(passoDoErroDoServidor("limite")).toBeNull();
    expect(passoDoErroDoServidor(undefined)).toBeNull();
  });

  it("o resumo do confira, sem a senha", () => {
    expect(resumoDoCadastro(ok)).toEqual([
      { passo: "nome", rotulo: "nome", valor: "Joana Prado" },
      { passo: "cpf", rotulo: "CPF", valor: "390.533.447-05" },
      { passo: "nascimento", rotulo: "nascimento", valor: "10/02/1985" },
      { passo: "telefone", rotulo: "celular", valor: "(11) 98888-7777" },
      { passo: "email", rotulo: "e-mail", valor: "joana@exemplo.com" },
    ]);
  });
});
