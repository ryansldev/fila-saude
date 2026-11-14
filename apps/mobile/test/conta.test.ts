import { describe, expect, it } from "vitest";
import { cpfEscondido, iniciais, nomeDoMunicipio, primeiroNome, textoDosAvisos } from "@/lib/conta";

describe("cpfEscondido", () => {
  it("mostra só o meio do CPF, como nos apps do governo", () => {
    expect(cpfEscondido("52998224725")).toBe("•••.982.247-••");
    expect(cpfEscondido("529.982.247-25")).toBe("•••.982.247-••");
  });
  it("CPF incompleto ou vazio não aparece", () => {
    expect(cpfEscondido("")).toBe("");
    expect(cpfEscondido("123")).toBe("");
  });
});

describe("iniciais e primeiro nome", () => {
  it("pega a primeira e a última inicial", () => {
    expect(iniciais("Ana Maria da Silva")).toBe("AS");
    expect(iniciais("  joão ")).toBe("J");
    expect(iniciais("")).toBe("");
  });
  it("primeiro nome em minúsculas, no estilo do app", () => {
    expect(primeiroNome("Ana Maria da Silva")).toBe("ana");
    expect(primeiroNome("")).toBe("");
  });
});

describe("nomeDoMunicipio", () => {
  const lista = [
    { slug: "exemplo", nome: "Município Exemplo", uf: "SP" },
    { slug: "sem-uf", nome: "Outro", uf: null },
  ];
  it("nome com UF, sem UF, ou nada se não achar", () => {
    expect(nomeDoMunicipio(lista, "exemplo")).toBe("Município Exemplo - SP");
    expect(nomeDoMunicipio(lista, "sem-uf")).toBe("Outro");
    expect(nomeDoMunicipio(lista, "x")).toBeNull();
    expect(nomeDoMunicipio(null, "exemplo")).toBeNull();
    expect(nomeDoMunicipio(lista, null)).toBeNull();
  });
});

describe("textoDosAvisos", () => {
  it("diz em palavras simples se os avisos estão ligados", () => {
    expect(textoDosAvisos({ tipo: "ligados" })).toEqual({ ligados: true, texto: "ligados neste celular" });
    expect(textoDosAvisos({ tipo: "perguntar" })).toEqual({ ligados: false, texto: "desligados. toque para ligar" });
    expect(textoDosAvisos({ tipo: "desligados", podePedir: false })).toEqual({
      ligados: false,
      texto: "desligados. toque para ligar nos ajustes",
    });
    expect(textoDosAvisos(null)).toEqual({ ligados: false, texto: "verificando…" });
  });
});
