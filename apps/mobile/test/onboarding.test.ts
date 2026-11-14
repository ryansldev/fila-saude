import { describe, expect, it } from "vitest";
import { CHAVE_ONBOARDING, destinoSemConta, passoAnterior, proximoPasso } from "@/lib/onboarding";

describe("onboarding", () => {
  it("usa uma chave própria no armazenamento", () => {
    expect(CHAVE_ONBOARDING).toBe("fila-saude.onboarding");
  });

  it("quem nunca viu vai para as boas-vindas; quem já viu cai em entrar, com as boas-vindas por baixo", () => {
    expect(destinoSemConta(null)).toEqual(["/boas-vindas"]);
    expect(destinoSemConta("")).toEqual(["/boas-vindas"]);
    // "voltar" em entrar leva às boas-vindas (de onde se cria a conta): nunca um beco sem saída.
    expect(destinoSemConta("visto")).toEqual(["/boas-vindas", "/entrar"]);
  });

  it("continuar avança até o último passo e depois termina", () => {
    expect(proximoPasso(0, 4)).toBe(1);
    expect(proximoPasso(2, 4)).toBe(3);
    expect(proximoPasso(3, 4)).toBe("fim");
  });

  it("voltar recua um passo e, no primeiro, sai do onboarding", () => {
    expect(passoAnterior(3)).toBe(2);
    expect(passoAnterior(1)).toBe(0);
    expect(passoAnterior(0)).toBe("sair");
  });
});
