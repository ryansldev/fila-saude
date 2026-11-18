import { Attempts } from "infra/auth/attempts";
import { describe, expect, it } from "vitest";

const MIN = 60_000;
const lockout = () => new Attempts({ max: 5, windowMs: 15 * MIN, lockout: true });

describe("tentativas do login (RN-ID-04)", () => {
  it("a 5ª falha bloqueia pela janela inteira, contada da 5ª falha; depois zera", () => {
    const a = lockout();
    for (let i = 0; i < 5; i++) a.count("k", i * MIN);
    expect(a.blocked("k", 5 * MIN)).toBe(true);
    expect(a.blocked("k", 4 * MIN + 15 * MIN - 1)).toBe(true);
    expect(a.blocked("k", 4 * MIN + 15 * MIN)).toBe(false);
    a.count("k", 20 * MIN);
    expect(a.blocked("k", 20 * MIN + 1)).toBe(false);
  });

  it("reservar é atômico: em paralelo, só passam as vagas que faltam", () => {
    const a = lockout();
    const passed = Array.from({ length: 200 }, () => a.reserve("k", 0)).filter(Boolean);
    expect(passed).toHaveLength(5);
  });

  it("reserva não liga o bloqueio: devolvida, nada fica; confirmada como senha errada, conta", () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) a.count("k", i);
    expect(a.reserve("k", 10)).toBe(true);
    a.release("k");
    expect(a.blocked("k", 11)).toBe(false);
    a.reserve("k", 12);
    a.fail("k", 12);
    expect(a.blocked("k", 13)).toBe(true);
  });

  it("reserva esquecida (o pedido falhou sem resposta) vence sozinha em 30 s", () => {
    const a = lockout();
    for (let i = 0; i < 5; i++) a.reserve("k", 0);
    expect(a.reserve("k", 1_000)).toBe(false);
    expect(a.reserve("k", 30_001)).toBe(true);
    expect(a.blocked("k", 30_001)).toBe(false);
  });

  it("acertar solta a própria reserva", () => {
    const a = lockout();
    a.reserve("k", 0);
    a.reset("k");
    expect(Array.from({ length: 9 }, () => a.reserve("k", 1)).filter(Boolean)).toHaveLength(5);
  });

  it("acertar zera", () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) a.count("k", i);
    a.reset("k");
    for (let i = 0; i < 4; i++) a.count("k", 10 + i);
    expect(a.blocked("k", 20)).toBe(false);
  });
});

describe("limite de consultas de CPF (RN-ID-07): janela deslizante, sem bloqueio fixo", () => {
  it("20 na última hora bloqueiam; a mais antiga vencendo, abre uma vaga", () => {
    const a = new Attempts({ max: 3, windowMs: 60 * MIN });
    a.count("k", 0);
    a.count("k", 50 * MIN);
    a.count("k", 59 * MIN);
    expect(a.blocked("k", 59 * MIN)).toBe(true);
    expect(a.blocked("k", 60 * MIN + 1)).toBe(false);
    expect(a.blocked("outra", 0)).toBe(false);
  });
});
