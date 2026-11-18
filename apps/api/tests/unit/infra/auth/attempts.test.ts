import { Attempts } from "infra/auth/attempts";
import { describe, expect, it } from "vitest";

const MIN = 60_000;
const lockout = () => new Attempts({ max: 5, windowMs: 15 * MIN, lockout: true });
const tokens = (a: Attempts, n: number, now: number) =>
  Array.from({ length: n }, () => a.reserve("k", now)).filter((r) => typeof r === "number");

describe("tentativas do login (RN-ID-04)", () => {
  it("a 5ª falha bloqueia pela janela inteira, contada da 5ª falha; depois zera", () => {
    const a = lockout();
    for (let i = 0; i < 5; i++) a.count("k", i * MIN);
    expect(a.blocked("k", 5 * MIN)).toBe(true);
    expect(a.reserve("k", 5 * MIN)).toBe("blocked");
    expect(a.blocked("k", 4 * MIN + 15 * MIN - 1)).toBe(true);
    expect(a.blocked("k", 4 * MIN + 15 * MIN)).toBe(false);
    a.count("k", 20 * MIN);
    expect(a.blocked("k", 20 * MIN + 1)).toBe(false);
  });

  it("reservar é atômico: em paralelo, só passam as vagas que faltam; os outros ouvem 'ocupado', não 'bloqueado'", () => {
    const a = lockout();
    expect(tokens(a, 200, 0)).toHaveLength(5);
    expect(a.reserve("k", 0)).toBe("busy");
  });

  it("cada pedido solta a própria reserva, mesmo depois que uma mais antiga venceu", () => {
    const a = lockout();
    const [old] = tokens(a, 1, 0) as number[];
    const [fresh] = tokens(a, 1, 31_000) as number[];
    a.release("k", old as number); // a antiga já venceu: não leva a vaga de outro pedido
    expect(tokens(a, 9, 31_001)).toHaveLength(4);
    a.release("k", fresh as number);
    expect(tokens(a, 9, 31_002)).toHaveLength(1);
  });

  it("reserva não liga o bloqueio; só a senha errada confirmada conta", () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) a.count("k", i);
    const [t] = tokens(a, 1, 10) as number[];
    a.release("k", t as number);
    expect(a.blocked("k", 11)).toBe(false);
    const [u] = tokens(a, 1, 12) as number[];
    a.fail("k", u as number, 12);
    expect(a.blocked("k", 13)).toBe(true);
  });

  it("reserva esquecida (o pedido caiu sem resposta) vence sozinha em 30 s", () => {
    const a = lockout();
    tokens(a, 5, 0);
    expect(a.reserve("k", 1_000)).toBe("busy");
    expect(typeof a.reserve("k", 30_001)).toBe("number");
  });

  it("acertar solta a própria reserva e zera a contagem", () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) a.count("k", i);
    const [t] = tokens(a, 1, 5) as number[];
    a.reset("k", t as number);
    expect(tokens(a, 9, 6)).toHaveLength(5);
  });
});

describe("limite de consultas de CPF (RN-ID-07): janela deslizante, sem bloqueio fixo", () => {
  it("o máximo na última hora bloqueia; a mais antiga vencendo, abre uma vaga", () => {
    const a = new Attempts({ max: 3, windowMs: 60 * MIN });
    a.count("k", 0);
    a.count("k", 50 * MIN);
    a.count("k", 59 * MIN);
    expect(a.blocked("k", 59 * MIN)).toBe(true);
    expect(a.blocked("k", 60 * MIN + 1)).toBe(false);
    expect(a.blocked("outra", 0)).toBe(false);
  });
});
