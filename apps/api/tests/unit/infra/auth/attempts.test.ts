import { MemoryStore, SlidingLimit } from "infra/auth/attempts";
import { describe, expect, it } from "vitest";

const MIN = 60_000;

describe("limite de consultas de CPF (RN-ID-07): janela deslizante", () => {
  it("o máximo na última hora bloqueia; a mais antiga vencendo, abre uma vaga", async () => {
    const a = new SlidingLimit({ max: 3, windowMs: 60 * MIN }, new MemoryStore());
    expect(await a.take("k", 0)).toBe(true);
    expect(await a.take("k", 50 * MIN)).toBe(true);
    expect(await a.take("k", 59 * MIN)).toBe(true);
    expect(await a.take("k", 59 * MIN)).toBe(false);
    expect(await a.take("k", 60 * MIN + 1)).toBe(true);
    expect(await a.take("outra", 0)).toBe(true);
  });

  it("conferir e contar é uma coisa só: em paralelo, não passa do máximo", async () => {
    const a = new SlidingLimit({ max: 3, windowMs: 60 * MIN }, new MemoryStore());
    const results = await Promise.all(Array.from({ length: 20 }, () => a.take("k", 0)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });
});

describe("NC5: regras diferentes no mesmo armazenamento", () => {
  it("a mesma chave em duas regras não se mistura (cada regra tem o próprio prefixo)", async () => {
    const { Lockout } = await import("infra/auth/login-lockout");
    const store = new MemoryStore();
    const limit = new SlidingLimit({ max: 1, windowMs: 60 * MIN }, store);
    const lock = new Lockout({ max: 5, blockMs: 15 * MIN, reservationMs: MIN }, store);
    expect(await limit.take("k", 0)).toBe(true);
    expect(await lock.reserve("k", 0)).not.toMatch(/^(blocked|busy)$/);
    expect(await limit.take("k", 0)).toBe(false);
  });
});

describe("AD-064: vaga do teto reservada antes de conferir a senha", () => {
  it("sem confirmação, a vaga vence em pouco tempo (o pedido caiu); confirmada, fica a janela toda", async () => {
    const a = new SlidingLimit({ max: 1, windowMs: 60 * MIN, pendingMs: MIN }, new MemoryStore());
    expect(await a.reserve("k", 0)).not.toBeNull();
    expect(await a.reserve("k", 30_000)).toBeNull();
    const t = await a.reserve("k", MIN + 1);
    expect(t).not.toBeNull();
    await a.confirm("k", t as string, MIN + 2);
    expect(await a.reserve("k", 50 * MIN)).toBeNull();
  });
});
