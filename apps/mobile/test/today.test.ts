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

  it("RN-SES-05: modo manual no bilhete e na linha: procure a recepção (o QR continua, a unidade pode tê-lo)", () => {
    const manual: Situation = { kind: "no_estimate", present: false, manual: true };
    expect(ticketCardFor({ ticket: "C-003", itemState: "remote" }, manual)).toEqual({
      banner: "procure a recepção",
      ticket: "C-003",
      button: "qr",
    });
    expect(rowFor(manual)).toEqual({ box: null, sentence: "modo manual: procure a recepção" });
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

  it("frases que não se contradizem: 5º não é 'o próximo'; reserva e sua vez não são 'a fila não abriu'", () => {
    expect(rowFor({ kind: "position", position: 5, minutes: 0, present: false, leave: false })).toEqual({
      box: "5º",
      sentence: "já já",
    });
    expect(rowFor({ kind: "reserve" }).sentence).toBe("na reserva: se alguém desistir, a vaga é sua");
    expect(rowFor({ kind: "turn", ticket: "C-001", station: "Sala 1" }).sentence).toBe("é a sua vez");
    expect(rowFor({ kind: "late" }).sentence).toBe("a fila vai abrir");
    expect(ticketCardFor({ ticket: null, itemState: null }, { kind: "reserve" }).banner).toBe("você está na reserva");
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

describe("pausa na aba hoje (RN-EST-06)", () => {
  const inPause = (noReturn: boolean, position = 5, minutes = 70): Situation => ({
    kind: "position",
    position,
    minutes,
    present: false,
    leave: false,
    pause: {
      title: noReturn ? "pausa por tempo indeterminado" : "pausa, volta às 13h32",
      started: true,
      noReturn,
      at: "12h32",
      back: noReturn ? null : "13h32",
    },
  });

  it("o bilhete diz a pausa na faixa; a linha mostra o tempo, ou a pausa sem hora de volta", () => {
    expect(ticketCardFor({ ticket: "C-005", itemState: "remote" }, inPause(false))).toEqual({
      banner: "pausa, volta às 13h32",
      ticket: "C-005",
      button: "qr",
    });
    expect(rowFor(inPause(false))).toEqual({ box: "5º", sentence: "cerca de 70 min" });
    expect(rowFor(inPause(true))).toEqual({ box: "5º", sentence: "pausa por tempo indeterminado" });
    // 1º da fila com a pausa em curso: o tempo (que soma a pausa) vale mais que "você é o próximo".
    expect(rowFor(inPause(false, 1, 60))).toEqual({ box: "1º", sentence: "cerca de 60 min" });
  });

  it("opção C: na unidade, quem recebeu a justificativa vê 'pausa antes da sua vez' na faixa", () => {
    const held: Situation = {
      kind: "position",
      position: 1,
      minutes: 60,
      present: true,
      leave: false,
      pause: {
        title: "pausa, volta às 13h32",
        started: true,
        noReturn: false,
        at: "12h32",
        back: "13h32",
        beforeTurn: true,
      },
    };
    expect(ticketCardFor({ ticket: "C-005", itemState: "present" }, held)).toEqual({
      banner: "pausa antes da sua vez",
      ticket: "C-005",
      button: null,
    });
  });
});
