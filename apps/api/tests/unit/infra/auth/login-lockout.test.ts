import { Lockout } from "infra/auth/login-lockout";
import { describe, expect, it } from "vitest";

const MIN = 60_000;
const lockout = () => new Lockout({ max: 5, blockMs: 15 * MIN, reservationMs: 60_000 });
const tokens = (a: Lockout, n: number, now: number) =>
  Array.from({ length: n }, () => a.reserve("k", now)).filter((r) => typeof r === "number") as number[];
const fail = (a: Lockout, now: number) => {
  const [t] = tokens(a, 1, now);
  a.fail("k", t as number, now);
};

describe("bloqueio do login (RN-ID-04)", () => {
  it("5 erros seguidos bloqueiam por 15 min, contados do 5º; depois começa do zero", () => {
    const a = lockout();
    for (let i = 0; i < 5; i++) fail(a, i * MIN);
    expect(a.reserve("k", 5 * MIN)).toBe("blocked");
    expect(a.reserve("k", 4 * MIN + 15 * MIN - 1)).toBe("blocked");
    fail(a, 4 * MIN + 15 * MIN);
    expect(typeof a.reserve("k", 20 * MIN)).toBe("number");
  });

  it("erros espaçados também somam: só acertar zera (não há janela para esperar passar)", () => {
    const a = lockout();
    for (let i = 0; i < 5; i++) fail(a, i * 20 * MIN);
    expect(a.reserve("k", 80 * MIN + 1)).toBe("blocked");
  });

  it("reservar é atômico: em paralelo, só passam as vagas que faltam; os outros ouvem 'ocupado'", () => {
    const a = lockout();
    expect(tokens(a, 200, 0)).toHaveLength(5);
    expect(a.reserve("k", 0)).toBe("busy");
  });

  it("cada pedido solta a própria reserva, mesmo depois que uma mais antiga venceu", () => {
    const a = lockout();
    const [old] = tokens(a, 1, 0);
    const [fresh] = tokens(a, 1, 61_000);
    a.release("k", old as number);
    expect(tokens(a, 9, 61_001)).toHaveLength(4);
    a.release("k", fresh as number);
    expect(tokens(a, 9, 61_002)).toHaveLength(1);
  });

  it("reserva não liga o bloqueio e vence sozinha se o pedido cair", () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) fail(a, i);
    const [t] = tokens(a, 1, 10);
    expect(a.reserve("k", 11)).toBe("busy");
    a.release("k", t as number);
    expect(typeof a.reserve("k", 12)).toBe("number");
    expect(a.reserve("k", 13)).toBe("busy");
    expect(typeof a.reserve("k", 12 + 60_001)).toBe("number");
  });

  it("acertar solta a própria reserva e zera os erros", () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) fail(a, i);
    const [t] = tokens(a, 1, 5);
    a.reset("k", t as number);
    expect(tokens(a, 9, 6)).toHaveLength(5);
  });
});
