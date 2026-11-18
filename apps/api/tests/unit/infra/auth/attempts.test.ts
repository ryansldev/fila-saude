import { Attempts } from "infra/auth/attempts";
import { describe, expect, it } from "vitest";

const MIN = 60_000;

describe("tentativas (RN-ID-04, RN-ID-07)", () => {
  it("a 5ª falha bloqueia pela janela inteira, contada da 5ª falha; depois zera", () => {
    const a = new Attempts({ max: 5, windowMs: 15 * MIN });
    for (let i = 0; i < 5; i++) {
      expect(a.reserve("k", i * MIN)).toBe(true);
    }
    expect(a.reserve("k", 5 * MIN)).toBe(false);
    expect(a.reserve("k", 4 * MIN + 15 * MIN - 1)).toBe(false);
    // Passou o bloqueio: começa do zero (não é uma tentativa só e bloqueia de novo).
    for (let i = 0; i < 4; i++) expect(a.reserve("k", 20 * MIN + i)).toBe(true);
    expect(a.blocked("k", 20 * MIN + 10)).toBe(false);
  });

  it("reservar é atômico: pedidos em paralelo não passam todos da checagem", () => {
    const a = new Attempts({ max: 5, windowMs: 15 * MIN });
    const passed = Array.from({ length: 200 }, () => a.reserve("k", 0)).filter(Boolean);
    expect(passed).toHaveLength(5);
  });

  it("devolver a tentativa (pedido que não era senha errada) e acertar a senha zeram o que deve", () => {
    const a = new Attempts({ max: 2, windowMs: MIN });
    a.reserve("k", 0);
    a.refund("k");
    a.reserve("k", 1);
    expect(a.blocked("k", 2)).toBe(false);
    a.reserve("k", 3);
    a.reset("k");
    expect(a.blocked("k", 4)).toBe(false);
  });

  it("count conta sem bloquear a chamada (limite de consultas de CPF)", () => {
    const a = new Attempts({ max: 3, windowMs: 15 * MIN });
    for (let i = 0; i < 3; i++) a.count("k", i);
    expect(a.blocked("k", 10)).toBe(true);
    expect(a.blocked("outra", 10)).toBe(false);
  });
});
