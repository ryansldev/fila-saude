import { describe, expect, it } from "vitest";
import { destinationWithoutAccount, introButtons, KEY_ONBOARDING, nextStep, previousStep } from "@/lib/onboarding";

describe("onboarding", () => {
  it("usa uma chave própria no armazenamento", () => {
    expect(KEY_ONBOARDING).toBe("fila-saude.onboarding");
  });

  it("quem nunca viu vai para as boas-vindas; quem já viu cai em entrar, com as boas-vindas por baixo", () => {
    expect(destinationWithoutAccount(null)).toEqual(["/boas-vindas"]);
    expect(destinationWithoutAccount("")).toEqual(["/boas-vindas"]);
    // "voltar" em entrar leva às boas-vindas (de onde se cria a conta): nunca um beco sem saída.
    expect(destinationWithoutAccount("visto")).toEqual(["/boas-vindas", "/entrar"]);
  });

  it("continuar avança até o último passo e depois termina", () => {
    expect(nextStep(0, 4)).toBe(1);
    expect(nextStep(2, 4)).toBe(3);
    expect(nextStep(3, 4)).toBe("end");
  });

  it("voltar recua um passo e, no primeiro, sai do onboarding", () => {
    expect(previousStep(3)).toBe(2);
    expect(previousStep(1)).toBe(0);
    expect(previousStep(0)).toBe("leave");
  });
});

describe('botões do "como funciona"', () => {
  it("sem conta: continuar ou pular para criar a conta; no fim, criar ou entrar", () => {
    expect(introButtons(false, false)).toEqual({ main: "continuar", secondary: "pular" });
    expect(introButtons(true, false)).toEqual({ main: "criar minha conta", secondary: "já tenho conta" });
  });
  it("revendo pela conta (já tem conta): só continuar e, no fim, entendi; nada de cadastro", () => {
    expect(introButtons(false, true)).toEqual({ main: "continuar", secondary: "fechar" });
    expect(introButtons(true, true)).toEqual({ main: "entendi", secondary: null });
  });
});
