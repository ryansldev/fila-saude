import { describe, expect, it } from "vitest";
import { bilheteDo, contagemDasAbas, linhaDo, ordenarDoDia } from "@/lib/hoje";
import type { Situacao } from "@/lib/textos";

const pos = (posicao: number, presente = false): Situacao => ({
  tipo: "posicao",
  posicao,
  minutos: posicao * 5,
  presente,
  sair: false,
});

describe("a aba hoje", () => {
  it("o que pede ação agora vira o bilhete", () => {
    const itens: { id: string; sit: Situacao }[] = [
      { id: "aguardando", sit: { tipo: "aguardando" } },
      { id: "casa3", sit: pos(3) },
      { id: "casa2", sit: pos(2) },
      { id: "confirmar", sit: { tipo: "alocada" } },
      { id: "unidade", sit: pos(4, true) },
      { id: "venha", sit: { tipo: "venha" } },
      { id: "recepcao", sit: { tipo: "recepcao" } },
      { id: "sem", sit: { tipo: "sem_previsao", presente: false } },
    ];
    expect(ordenarDoDia(itens).map((x) => x.id)).toEqual([
      "venha",
      "recepcao",
      "unidade",
      "casa2",
      "casa3",
      "sem",
      "confirmar",
      "aguardando",
    ]);
  });

  it("o bilhete: a faixa, a senha e o botão de cada situação", () => {
    expect(bilheteDo({ senha: "C-003", itemEstado: "remoto" }, { tipo: "venha" })).toEqual({
      faixa: "venha agora!",
      senha: "C-003",
      botao: "qr",
    });
    expect(bilheteDo({ senha: "V-002", itemEstado: "remoto" }, pos(2))).toEqual({
      faixa: "você está na fila",
      senha: "V-002",
      botao: "qr",
    });
    expect(bilheteDo({ senha: "C-002", itemEstado: "presente" }, pos(1, true))).toEqual({
      faixa: "você está na unidade",
      senha: "C-002",
      botao: null,
    });
    expect(bilheteDo({ senha: "C-004", itemEstado: "presente" }, { tipo: "recepcao" })).toMatchObject({
      faixa: "mostre na recepção",
      botao: null,
    });
    expect(bilheteDo({ senha: null, itemEstado: null }, { tipo: "alocada" })).toEqual({
      faixa: "confirme a sua data",
      senha: null,
      botao: "confirmar",
    });
    expect(bilheteDo({ senha: null, itemEstado: null }, { tipo: "aguardando" })).toEqual({
      faixa: "a fila ainda não abriu",
      senha: null,
      botao: null,
    });
  });

  it("a linha: o quadro com a posição e uma frase curta", () => {
    expect(linhaDo(pos(2))).toEqual({ quadro: "2º", frase: "cerca de 10 min" });
    expect(linhaDo(pos(1))).toEqual({ quadro: "1º", frase: "você é o próximo" });
    expect(linhaDo({ tipo: "venha" })).toEqual({ quadro: null, frase: "venha agora" });
    expect(linhaDo({ tipo: "aguardando" })).toEqual({ quadro: null, frase: "a fila ainda não abriu" });
  });
});

describe("o número nas abas de baixo", () => {
  const de = (...grupos: ("hoje" | "proximos" | "sem_data" | "encerrados")[]) =>
    grupos.map((grupo) => ({ resumo: { grupo } }));

  it("'atendimentos' conta os de outros dias e os sem data; hoje e encerrados ficam de fora", () => {
    expect(contagemDasAbas(de("hoje", "proximos", "sem_data", "encerrados", "proximos"))).toEqual({ atendimentos: 3 });
  });

  it("sem nada pendente, nenhuma aba tem número", () => {
    expect(contagemDasAbas(de("hoje", "encerrados"))).toEqual({});
    expect(contagemDasAbas([])).toEqual({});
  });
});
