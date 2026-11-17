import { describe, expect, it } from "vitest";
import type { Situation } from "@/lib/texts";
import { rowFor, sortForDay, tabCount, ticketCardFor } from "@/lib/today";

const positioned = (position: number, present = false): Situation => ({
  kind: "position",
  position,
  minutes: position * 5,
  present,
  leave: false,
});

describe("a aba hoje", () => {
  it("o que pede ação agora vira o bilhete", () => {
    const items: { id: string; sit: Situation }[] = [
      { id: "waiting", sit: { kind: "waiting" } },
      { id: "casa3", sit: positioned(3) },
      { id: "casa2", sit: positioned(2) },
      { id: "confirm", sit: { kind: "allocated" } },
      { id: "unit", sit: positioned(4, true) },
      { id: "come", sit: { kind: "come" } },
      { id: "reception", sit: { kind: "reception" } },
      { id: "sem", sit: { kind: "no_estimate", present: false } },
    ];
    expect(sortForDay(items).map((x) => x.id)).toEqual([
      "come",
      "reception",
      "unit",
      "casa2",
      "casa3",
      "sem",
      "confirm",
      "waiting",
    ]);
  });

  it("o bilhete: a faixa, a senha e o botão de cada situação", () => {
    expect(ticketCardFor({ ticket: "C-003", itemState: "remote" }, { kind: "come" })).toEqual({
      banner: "venha agora!",
      ticket: "C-003",
      button: "qr",
    });
    expect(ticketCardFor({ ticket: "V-002", itemState: "remote" }, positioned(2))).toEqual({
      banner: "você está na fila",
      ticket: "V-002",
      button: "qr",
    });
    expect(ticketCardFor({ ticket: "C-002", itemState: "present" }, positioned(1, true))).toEqual({
      banner: "você está na unidade",
      ticket: "C-002",
      button: null,
    });
    expect(ticketCardFor({ ticket: "C-004", itemState: "present" }, { kind: "reception" })).toMatchObject({
      banner: "mostre na recepção",
      button: null,
    });
    expect(ticketCardFor({ ticket: null, itemState: null }, { kind: "allocated" })).toEqual({
      banner: "confirme a sua data",
      ticket: null,
      button: "confirm",
    });
    expect(ticketCardFor({ ticket: null, itemState: null }, { kind: "waiting" })).toEqual({
      banner: "a fila ainda não abriu",
      ticket: null,
      button: null,
    });
  });

  it("a linha: o quadro com a posição e uma frase curta", () => {
    expect(rowFor(positioned(2))).toEqual({ box: "2º", sentence: "cerca de 10 min" });
    expect(rowFor(positioned(1))).toEqual({ box: "1º", sentence: "você é o próximo" });
    expect(rowFor({ kind: "come" })).toEqual({ box: null, sentence: "venha agora" });
    expect(rowFor({ kind: "waiting" })).toEqual({ box: null, sentence: "a fila ainda não abriu" });
  });
});

describe("o número nas abas de baixo", () => {
  const de = (...groups: ("today" | "upcoming" | "no_date" | "closed")[]) =>
    groups.map((group) => ({ summary: { group } }));

  it("'atendimentos' conta os de outros dias e os sem data; hoje e encerrados ficam de fora", () => {
    expect(tabCount(de("today", "upcoming", "no_date", "closed", "upcoming"))).toEqual({ appointments: 3 });
  });

  it("sem nada pendente, nenhuma aba tem número", () => {
    expect(tabCount(de("today", "closed"))).toEqual({});
    expect(tabCount([])).toEqual({});
  });
});
