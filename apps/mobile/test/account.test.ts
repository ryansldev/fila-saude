import { describe, expect, it } from "vitest";
import { firstName, hiddenCpf, initials, municipalityName, noticeText, properName } from "@/lib/account";

describe("hiddenCpf", () => {
  it("mostra só o meio do CPF, como nos apps do governo", () => {
    expect(hiddenCpf("52998224725")).toBe("•••.982.247-••");
    expect(hiddenCpf("529.982.247-25")).toBe("•••.982.247-••");
  });
  it("CPF incompleto ou vazio não aparece", () => {
    expect(hiddenCpf("")).toBe("");
    expect(hiddenCpf("123")).toBe("");
  });
});

describe("iniciais e primeiro nome", () => {
  it("pega a primeira e a última inicial", () => {
    expect(initials("Ana Maria da Silva")).toBe("AS");
    expect(initials("  joão ")).toBe("J");
    expect(initials("")).toBe("");
  });
  it("primeiro nome em minúsculas, no estilo do app", () => {
    expect(firstName("Ana Maria da Silva")).toBe("Ana");
    expect(firstName("bRUNO lima")).toBe("Bruno");
    expect(firstName("")).toBe("");
  });
});

describe("municipalityName", () => {
  const list = [
    { slug: "exemplo", name: "Município Exemplo", uf: "SP" },
    { slug: "sem-uf", name: "Outro", uf: null },
  ];
  it("nome com UF, sem UF, ou nada se não achar", () => {
    expect(municipalityName(list, "exemplo")).toBe("Município Exemplo - SP");
    expect(municipalityName(list, "sem-uf")).toBe("Outro");
    expect(municipalityName(list, "x")).toBeNull();
    expect(municipalityName(null, "exemplo")).toBeNull();
    expect(municipalityName(list, null)).toBeNull();
  });
});

describe("noticeText", () => {
  it("diz em palavras simples se os avisos estão ligados", () => {
    expect(noticeText({ kind: "on" })).toEqual({ on: true, text: "ligados neste celular" });
    expect(noticeText({ kind: "ask" })).toEqual({ on: false, text: "desligados. toque para ligar" });
    expect(noticeText({ kind: "off", canRequest: false })).toEqual({
      on: false,
      text: "desligados. toque para ligar nos ajustes",
    });
    expect(noticeText(null)).toEqual({ on: false, text: "verificando…" });
  });
});

describe("nomes de pessoas", () => {
  it("primeira letra maiúscula, conectivos em minúsculas", () => {
    expect(properName("maria DA silva")).toBe("Maria da Silva");
    expect(properName("  joão  dos santos e souza ")).toBe("João dos Santos e Souza");
    expect(properName("")).toBe("");
  });
});
