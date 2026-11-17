import { describe, expect, it } from "vitest";
import {
  nextStep,
  passwordRule,
  previousStep,
  REGISTRATION_STEPS,
  registrationSummary,
  serverErrorStep,
  stepError,
} from "@/lib/registration";

const ok = {
  name: "Joana Prado",
  cpf: "390.533.447-05",
  birthDate: "10/02/1985",
  phone: "(11) 98888-7777",
  password: "segredo123",
  email: "joana@exemplo.com",
};

describe("cadastro, uma pergunta por tela", () => {
  it("as telas em ordem, com o confira no fim", () => {
    expect(REGISTRATION_STEPS).toEqual(["name", "cpf", "birthDate", "phone", "password", "email", "review"]);
  });

  it("cada tela só olha o seu campo", () => {
    const v = { ...ok, cpf: "111.111.111-11", password: "curta" };
    expect(stepError("name", v)).toBeUndefined();
    expect(stepError("cpf", v)).toMatch(/CPF/);
    expect(stepError("password", v)).toBe("a senha precisa de pelo menos 8 caracteres.");
    expect(stepError("review", ok)).toBeUndefined();
    expect(stepError("cpf", { ...ok, cpf: "" })).toBe("digite o CPF.");
  });

  it("continuar avança; depois de corrigir, volta ao confira", () => {
    expect(nextStep("name", false)).toBe("cpf");
    expect(nextStep("email", false)).toBe("review");
    expect(nextStep("cpf", true)).toBe("review");
  });

  it("voltar: a primeira tela sai do cadastro", () => {
    expect(previousStep("name")).toBeNull();
    expect(previousStep("cpf")).toBe("name");
    expect(previousStep("review")).toBe("email");
  });

  it("a regra da senha marca enquanto digita", () => {
    expect(passwordRule("1234567")).toEqual({ eightCharacters: false });
    expect(passwordRule("12345678")).toEqual({ eightCharacters: true });
  });

  it("erro do servidor leva à tela do campo", () => {
    expect(serverErrorStep("cpf_in_use")).toBe("cpf");
    expect(serverErrorStep("invalid_cpf")).toBe("cpf");
    expect(serverErrorStep("email_in_use")).toBe("email");
    expect(serverErrorStep("limit")).toBeNull();
    expect(serverErrorStep(undefined)).toBeNull();
  });

  it("o resumo do confira, sem a senha", () => {
    expect(registrationSummary(ok)).toEqual([
      { step: "name", label: "nome", value: "Joana Prado" },
      { step: "cpf", label: "CPF", value: "390.533.447-05" },
      { step: "birthDate", label: "nascimento", value: "10/02/1985" },
      { step: "phone", label: "celular", value: "(11) 98888-7777" },
      { step: "email", label: "e-mail", value: "joana@exemplo.com" },
    ]);
  });
});
