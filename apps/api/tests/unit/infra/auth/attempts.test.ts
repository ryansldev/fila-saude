import { Attempts } from "infra/auth/attempts";
import { describe, expect, it } from "vitest";

const MIN = 60_000;

describe("tentativas (RN-ID-04, RN-ID-07)", () => {
  it("bloqueia depois do máximo na janela e libera quando a janela passa", () => {
    const a = new Attempts({ max: 3, windowMs: 15 * MIN });
    for (let i = 0; i < 3; i++) {
      expect(a.blocked("k", i)).toBe(false);
      a.count("k", i);
    }
    expect(a.blocked("k", 10)).toBe(true);
    expect(a.blocked("outra", 10)).toBe(false);
    expect(a.blocked("k", 15 * MIN + 1)).toBe(false);
  });
  it("acertar a senha zera a contagem", () => {
    const a = new Attempts({ max: 2, windowMs: MIN });
    a.count("k", 0);
    a.reset("k");
    a.count("k", 1);
    expect(a.blocked("k", 2)).toBe(false);
  });
});
