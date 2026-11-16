import { describe, expect, it } from "vitest";
import { menuDoPainel, perfisNaUnidade } from "@/lib/navegacao";
import { linhasDoEndereco, textoDoResumo, unidadeInicial } from "@/lib/unidade-atual";

describe("a unidade no menu, para o painel inteiro", () => {
  it("escolha inicial: a guardada se ainda valer; senão, a primeira; sem unidades, nenhuma", () => {
    expect(unidadeInicial("b", ["a", "b"])).toBe("b");
    expect(unidadeInicial("x", ["a", "b"])).toBe("a");
    expect(unidadeInicial(null, ["a"])).toBe("a");
    expect(unidadeInicial(null, [])).toBeNull();
  });

  it("o menu mostra só o que a pessoa pode fazer na unidade escolhida", () => {
    const perfis = [
      { perfil: "recepcao" as const, unidadeId: "u1" },
      { perfil: "agendar" as const, unidadeId: "u2" },
    ];
    const rotulos = (u: string) => menuDoPainel(perfisNaUnidade(perfis, u)).map((i) => i.rotulo);
    expect(rotulos("u1")).toEqual(["Fila do dia", "QR de entrada"]);
    expect(rotulos("u2")).toEqual(["Agendamento"]);
  });

  it("perfil do município (unidade nula) vale em toda unidade", () => {
    const perfis = [{ perfil: "gestao_sms" as const, unidadeId: null }];
    expect(perfisNaUnidade(perfis, "u9")).toEqual(perfis);
    expect(perfisNaUnidade(perfis, null)).toEqual(perfis);
  });

  it("o que acontece hoje na unidade, em palavras", () => {
    const fuso = "America/Sao_Paulo";
    expect(textoDoResumo({ abertas: 2, proximaAbertura: null }, fuso)).toBe("2 sessões abertas");
    expect(textoDoResumo({ abertas: 1, proximaAbertura: "2026-11-16T16:00:00.000Z" }, fuso)).toBe("1 sessão aberta");
    expect(textoDoResumo({ abertas: 0, proximaAbertura: "2026-11-16T16:00:00.000Z" }, fuso)).toBe("abre às 13:00");
    expect(textoDoResumo({ abertas: 0, proximaAbertura: null }, fuso)).toBe("nada hoje");
    expect(textoDoResumo(undefined, fuso)).toBeNull();
  });

  it("endereço em linhas, cada informação no seu lugar", () => {
    expect(
      linhasDoEndereco({
        logradouro: "Praça da Sé",
        numero: "100",
        bairro: "Sé",
        cep: "01001-000",
        complemento: "Bloco B",
      }),
    ).toEqual(["Praça da Sé, 100 (Bloco B)", "Sé", "CEP 01001-000"]);
    expect(
      linhasDoEndereco({ logradouro: "Rua A", numero: "1", bairro: "Centro", cep: "01001-000", complemento: null })[0],
    ).toBe("Rua A, 1");
  });

  it("o CEP sai com hífen (o banco guarda só os dígitos)", () => {
    expect(linhasDoEndereco({ logradouro: "Rua A", numero: "1", bairro: "Centro", cep: "01310100" })[2]).toBe(
      "CEP 01310-100",
    );
  });
});
