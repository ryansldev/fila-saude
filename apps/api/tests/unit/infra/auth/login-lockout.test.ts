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
        // As duas do `before` (teto e par) passam; a do `after` falha.
        if (calls > 2) throw new Error("banco fora");
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
    // Par e teto tentam cada um por si; os dois erros vão para o log.
    expect(errors).toHaveLength(2);
  });
});

describe("AD-064: contagem pelo par (login, IP) e teto por login", () => {
  const ctxOf = (ip: string, password = "errada", extra: Record<string, string> = {}) => ({
    path: "/sign-in/username",
    body: { username: "gestor", password },
    request: new Request("http://x/", { headers: { "x-forwarded-for": ip, ...extra } }),
    context: {} as { returned?: unknown },
  });
  const wrong = { body: { code: "INVALID_USERNAME_OR_PASSWORD" }, status: "UNAUTHORIZED" };
  const attempt = async (hooks: ReturnType<typeof import("infra/auth/login-lockout").loginLockout>, ip: string) => {
    const ctx = ctxOf(ip);
    try {
      await hooks.before(ctx);
    } catch (error) {
      return (error as { body?: { error?: string } }).body?.error;
    }
    const { APIError } = await import("better-auth/api");
    await hooks.after({ ...ctx, context: { returned: new APIError("UNAUTHORIZED", wrong.body) } });
    return "wrong";
  };

  it("5 erros de um IP bloqueiam só aquele par: o mesmo login, de outro IP, segue tentando", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const hooks = loginLockout(() => "gestor", new MemoryStore());
    for (let i = 0; i < 5; i++) expect(await attempt(hooks, "203.0.113.7")).toBe("wrong");
    expect(await attempt(hooks, "203.0.113.7")).toBe("login_locked");
    expect(await attempt(hooks, "198.51.100.1")).toBe("wrong");
  });

  it("no IPv6, o bloco /64 é um IP só (trocar de endereço dentro dele não zera)", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const hooks = loginLockout(() => "gestor", new MemoryStore());
    for (let i = 0; i < 5; i++) expect(await attempt(hooks, `2001:db8:1:2::${i + 1}`)).toBe("wrong");
    expect(await attempt(hooks, "2001:db8:1:2::99")).toBe("login_locked");
    expect(await attempt(hooks, "2001:db8:1:3::1")).toBe("wrong");
  });

  it("passado o teto (30 erros por hora no login, somando os IPs), qualquer IP precisa de captcha", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const hooks = loginLockout(() => "gestor", new MemoryStore());
    for (let i = 0; i < 30; i++) expect(await attempt(hooks, `198.51.100.${i}`)).toBe("wrong");
    expect(await attempt(hooks, "203.0.113.200")).toBe("captcha_required");
  });

  it("o teto vale também em paralelo: 100 IPs ao mesmo tempo não passam de 30 senhas conferidas", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const hooks = loginLockout(() => "gestor", new MemoryStore());
    const results = await Promise.all(
      Array.from({ length: 100 }, async (_, i) => {
        try {
          await hooks.before(ctxOf(`198.51.${Math.floor(i / 5)}.${i}`));
          return "passou";
        } catch {
          return "recusado";
        }
      }),
    );
    expect(results.filter((r) => r === "passou")).toHaveLength(30);
  });

  it("senha certa não gasta o teto", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const hooks = loginLockout(() => "gestor", new MemoryStore());
    for (let i = 0; i < 40; i++) {
      const ctx = ctxOf(`198.51.100.${i}`, "certa");
      await hooks.before(ctx);
      await hooks.after({ ...ctx, context: { returned: { ok: true } } });
    }
    expect(await attempt(hooks, "203.0.113.200")).toBe("wrong");
  });

  it("passado o teto, um captcha resolvido deixa tentar; um que não passa, não", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const store = new MemoryStore();
    const verify = async (ctx: { request?: unknown }) =>
      (ctx.request as Request).headers.get("x-captcha-token") === "bom";
    const hooks = loginLockout(() => "gestor", store, undefined, verify);
    for (let i = 0; i < 30; i++) await attempt(hooks, `198.51.100.${i}`);
    const without = ctxOf("203.0.113.9");
    await expect(hooks.before(without)).rejects.toMatchObject({ body: { error: "captcha_required" } });
    // Token mandado e recusado é outro código: o cliente não reenvia sozinho (senão entra em laço).
    await expect(hooks.before(ctxOf("203.0.113.9", "x", { "x-captcha-token": "ruim" }))).rejects.toMatchObject({
      body: { error: "captcha_failed" },
    });
    await expect(hooks.before(ctxOf("203.0.113.9", "x", { "x-captcha-token": "bom" }))).resolves.toBeUndefined();
  });

  it("par bloqueado responde 'bloqueado' sem gastar o captcha na Cloudflare", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    let asked = 0;
    const verify = async () => {
      asked++;
      return true;
    };
    const hooks = loginLockout(() => "gestor", new MemoryStore(), undefined, verify);
    for (let i = 0; i < 25; i++) await attempt(hooks, `198.51.100.${i}`);
    for (let i = 0; i < 5; i++) await attempt(hooks, "203.0.113.9");
    asked = 0;
    await expect(hooks.before(ctxOf("203.0.113.9", "x", { "x-captcha-token": "bom" }))).rejects.toMatchObject({
      body: { error: "login_locked" },
    });
    expect(asked).toBe(0);
  });

  it("par bloqueado não mexe no teto (a enxurrada de um IP bloqueado não pesa na conta)", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const store = new MemoryStore();
    let writes = 0;
    const counting: AttemptStore = {
      update(key, now, change) {
        if (key.startsWith("sliding:")) writes++;
        return store.update(key, now, change);
      },
    };
    const hooks = loginLockout(() => "gestor", counting);
    for (let i = 0; i < 5; i++) await attempt(hooks, "203.0.113.9");
    writes = 0;
    expect(await attempt(hooks, "203.0.113.9")).toBe("login_locked");
    expect(writes).toBe(0);
  });

  it("uma falha do banco ao recusar não vira 500: a recusa sai com o código certo", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const store = new MemoryStore();
    let fail = false;
    const flaky: AttemptStore = {
      update(key, now, change) {
        if (fail) return Promise.reject(new Error("banco fora"));
        return store.update(key, now, change);
      },
    };
    const errors: unknown[] = [];
    const hooks = loginLockout(
      () => "gestor",
      flaky,
      (e) => errors.push(e),
      async () => false,
    );
    for (let i = 0; i < 30; i++) await attempt(hooks, `198.51.100.${i}`);
    const ctx = ctxOf("203.0.113.9", "x", { "x-captcha-token": "ruim" });
    // O teto cheio é lido; a falha vem ao soltar a reserva do par na recusa.
    const original = flaky.update;
    let calls = 0;
    flaky.update = (key, now, change) => {
      calls++;
      fail = calls > 2;
      return original(key, now, change);
    };
    await expect(hooks.before(ctx)).rejects.toMatchObject({ body: { error: "captcha_failed" } });
    expect(errors).toHaveLength(1);
  });

  it("cabeçalho do captcha vazio é 'sem token' (pede o captcha), não 'recusado'", async () => {
    const { loginLockout } = await import("infra/auth/login-lockout");
    const hooks = loginLockout(
      () => "gestor",
      new MemoryStore(),
      undefined,
      async () => false,
    );
    for (let i = 0; i < 30; i++) await attempt(hooks, `198.51.100.${i}`);
    await expect(hooks.before(ctxOf("203.0.113.9", "x", { "x-captcha-token": "" }))).rejects.toMatchObject({
      body: { error: "captcha_required" },
    });
  });
});
