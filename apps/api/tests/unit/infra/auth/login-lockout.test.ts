import { type AttemptStore, MemoryStore } from "infra/auth/attempts";
import { Lockout } from "infra/auth/login-lockout";
import { describe, expect, it } from "vitest";

const MIN = 60_000;
const lockout = () => new Lockout({ max: 5, blockMs: 15 * MIN, reservationMs: 60_000 }, new MemoryStore());
const tokens = async (a: Lockout, n: number, now: number) =>
  (await Promise.all(Array.from({ length: n }, () => a.reserve("k", now)))).filter(
    (r) => r !== "blocked" && r !== "busy",
  );
const fail = async (a: Lockout, now: number) => {
  const [t] = await tokens(a, 1, now);
  await a.fail("k", t as string, now);
};
const isToken = (r: string) => r !== "blocked" && r !== "busy";

describe("bloqueio do login (RN-ID-04)", () => {
  it("5 erros seguidos bloqueiam por 15 min, contados do 5º; depois começa do zero", async () => {
    const a = lockout();
    for (let i = 0; i < 5; i++) await fail(a, i * MIN);
    expect(await a.reserve("k", 5 * MIN)).toBe("blocked");
    expect(await a.reserve("k", 4 * MIN + 15 * MIN - 1)).toBe("blocked");
    await fail(a, 4 * MIN + 15 * MIN);
    expect(isToken(await a.reserve("k", 20 * MIN))).toBe(true);
  });

  it("erros espaçados também somam: só acertar zera (não há janela para esperar passar)", async () => {
    const a = lockout();
    for (let i = 0; i < 5; i++) await fail(a, i * 20 * MIN);
    expect(await a.reserve("k", 80 * MIN + 1)).toBe("blocked");
  });

  it("erros esquecidos só depois de 7 dias sem tentativa (a linha vence e sai do banco)", async () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) await fail(a, 0);
    expect(await tokens(a, 9, 6 * 24 * 60 * MIN)).toHaveLength(1);
    const b = lockout();
    for (let i = 0; i < 4; i++) await fail(b, 0);
    expect(await tokens(b, 9, 7 * 24 * 60 * MIN + 1)).toHaveLength(5);
  });

  it("reservar é atômico: em paralelo, só passam as vagas que faltam; os outros ouvem 'ocupado'", async () => {
    const a = lockout();
    expect(await tokens(a, 200, 0)).toHaveLength(5);
    expect(await a.reserve("k", 0)).toBe("busy");
  });

  it("cada pedido solta a própria reserva, mesmo depois que uma mais antiga venceu", async () => {
    const a = lockout();
    const [old] = await tokens(a, 1, 0);
    const [fresh] = await tokens(a, 1, 61_000);
    await a.release("k", old as string, 61_000);
    expect(await tokens(a, 9, 61_001)).toHaveLength(4);
    await a.release("k", fresh as string, 61_001);
    expect(await tokens(a, 9, 61_002)).toHaveLength(1);
  });

  it("reserva não liga o bloqueio e vence sozinha se o pedido cair", async () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) await fail(a, i);
    const [t] = await tokens(a, 1, 10);
    expect(await a.reserve("k", 11)).toBe("busy");
    await a.release("k", t as string, 11);
    expect(isToken(await a.reserve("k", 12))).toBe(true);
    expect(await a.reserve("k", 13)).toBe("busy");
    expect(isToken(await a.reserve("k", 12 + 60_001))).toBe(true);
  });

  it("acertar solta a própria reserva e zera os erros", async () => {
    const a = lockout();
    for (let i = 0; i < 4; i++) await fail(a, i);
    const [t] = await tokens(a, 1, 5);
    await a.reset("k", t as string, 5);
    expect(await tokens(a, 9, 6)).toHaveLength(5);
  });
});

describe("gancho do login (RN-ID-04)", () => {
  it("uma falha do banco ao registrar o resultado não derruba um login que já deu certo", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    let calls = 0;
    const flaky: AttemptStore = {
      async update(key, now, change) {
        calls++;
        if (calls > 1) throw new Error("banco fora");
        return new MemoryStore().update(key, now, change);
      },
    };
    const errors: unknown[] = [];
    const hooks = loginLockout(
      () => "12345678901",
      flaky,
      (e) => errors.push(e),
    );
    const request = {};
    const ctx = { path: "/sign-in/username", body: { username: "x", password: "y" }, request, context: {} };
    await hooks.before(ctx);
    await expect(hooks.after({ ...ctx, context: { returned: { ok: true } } })).resolves.toBeUndefined();
    expect(errors).toHaveLength(1);
  });
});
