import { describe, expect, it } from "vitest";
import { idadeEm, mesmoDia, vespera } from "../src/tempo.ts";

const SP = "America/Sao_Paulo";
// America/Sao_Paulo é UTC-3 o ano todo (sem horário de verão desde 2019).
const emSP = (a: number, m: number, d: number, h = 0, min = 0, s = 0, ms = 0) =>
  Date.UTC(a, m - 1, d, h + 3, min, s, ms);

describe("idadeEm", () => {
  it("1 ano e 364 dias ainda tem 1 ano; 2 anos exatos tem 2 (dia do aniversário, no fuso)", () => {
    expect(idadeEm("2024-11-18", emSP(2026, 11, 17, 12), SP)).toBe(1);
    expect(idadeEm("2024-11-18", emSP(2026, 11, 18, 0), SP)).toBe(2);
  });

  it("59 até a véspera do aniversário, 60 desde 00:00 do dia no fuso", () => {
    expect(idadeEm("1966-11-17", emSP(2026, 11, 16, 23, 59, 59, 999), SP)).toBe(59);
    expect(idadeEm("1966-11-17", emSP(2026, 11, 17, 0), SP)).toBe(60);
  });

  it("usa o dia do fuso, não o dia UTC", () => {
    // 02:59Z de 18/11 ainda é 17/11 em São Paulo.
    expect(idadeEm("2024-11-18", Date.UTC(2026, 10, 18, 2, 59), SP)).toBe(1);
    expect(idadeEm("2024-11-18", Date.UTC(2026, 10, 18, 3, 0), SP)).toBe(2);
  });

  it("nascido em 29/02 faz anos em 01/03 nos anos comuns", () => {
    expect(idadeEm("2000-02-29", emSP(2027, 2, 28, 12), SP)).toBe(26);
    expect(idadeEm("2000-02-29", emSP(2027, 3, 1, 0), SP)).toBe(27);
  });
});

describe("mesmoDia", () => {
  it("compara o dia no fuso da unidade", () => {
    expect(mesmoDia(emSP(2026, 11, 17, 0), emSP(2026, 11, 17, 23, 59, 59, 999), SP)).toBe(true);
    expect(mesmoDia(emSP(2026, 11, 17, 23, 59, 59, 999), emSP(2026, 11, 18, 0), SP)).toBe(false);
  });
});

describe("vespera", () => {
  it("sessão às 00:30: a véspera começa 00:00 do dia anterior no fuso", () => {
    expect(vespera(emSP(2026, 11, 17, 0, 30), SP)).toBe(emSP(2026, 11, 16, 0));
  });

  it("sessão às 23:30: ainda é o dia da sessão, véspera é o dia anterior", () => {
    // 23:30 em SP já é 02:30Z do dia seguinte: um cálculo em UTC erraria o dia.
    expect(vespera(emSP(2026, 11, 17, 23, 30), SP)).toBe(emSP(2026, 11, 16, 0));
  });

  it("vira o mês e o ano", () => {
    expect(vespera(emSP(2027, 1, 1, 8), SP)).toBe(emSP(2026, 12, 31, 0));
  });
});
