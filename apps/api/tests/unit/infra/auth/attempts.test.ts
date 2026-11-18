import { SlidingLimit } from "infra/auth/attempts";
import { describe, expect, it } from "vitest";

const MIN = 60_000;

describe("limite de consultas de CPF (RN-ID-07): janela deslizante", () => {
  it("o máximo na última hora bloqueia; a mais antiga vencendo, abre uma vaga", () => {
    const a = new SlidingLimit({ max: 3, windowMs: 60 * MIN });
    a.count("k", 0);
    a.count("k", 50 * MIN);
    a.count("k", 59 * MIN);
    expect(a.blocked("k", 59 * MIN)).toBe(true);
    expect(a.blocked("k", 60 * MIN + 1)).toBe(false);
    expect(a.blocked("outra", 0)).toBe(false);
  });
});
