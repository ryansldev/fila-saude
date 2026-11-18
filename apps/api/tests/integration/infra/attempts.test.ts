import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { PostgresStore, SlidingLimit } from "infra/auth/attempts";
import { Lockout } from "infra/auth/login-lockout";
import database from "infra/database";
import { attempt } from "infra/database/central/schema/attempt";
import env from "infra/env";
import { describe, expect, it } from "vitest";

const key = () => `teste:${crypto.randomUUID()}`;
const MIN = 60_000;

describe("AD-063: contagem de tentativas no Postgres", () => {
  it("a tabela é UNLOGGED (não vai para o WAL, o backup nem as réplicas)", async () => {
    const r = await database.execute<{ relpersistence: string }>(
      sql`select relpersistence from pg_class where relname = 'attempt'`,
    );
    expect(r.rows[0]?.relpersistence).toBe("u");
  });

  it("guarda só o HMAC da chave, nunca o CPF ou o login", async () => {
    const k = `cpf:${Math.floor(Math.random() * 1e11)}`;
    await new SlidingLimit({ name: "teste", max: 3, windowMs: MIN }, new PostgresStore()).take(k, Date.now());
    const hashed = createHmac("sha256", env.BETTER_AUTH_SECRET).update(`sliding:teste:${k}`).digest("hex");
    expect(await database.select().from(attempt).where(eq(attempt.key, hashed))).toHaveLength(1);
    expect(await database.select().from(attempt).where(eq(attempt.key, k))).toHaveLength(0);
  });

  it("vale entre instâncias: dois contadores sobre o mesmo banco somam juntos, em paralelo", async () => {
    const k = key();
    const options = { max: 5, blockMs: 15 * MIN, reservationMs: MIN };
    const a = new Lockout(options, new PostgresStore());
    const b = new Lockout(options, new PostgresStore());
    const now = Date.now();
    const all = await Promise.all(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).reserve(k, now)));
    expect(all.filter((r) => r !== "busy" && r !== "blocked")).toHaveLength(5);
  });

  it("a limpeza apaga as linhas vencidas e deixa as outras", async () => {
    const store = new PostgresStore();
    const limit = new SlidingLimit({ name: "teste", max: 3, windowMs: MIN }, store);
    const old = key();
    const fresh = key();
    const now = Date.now();
    await limit.take(old, now - 2 * MIN);
    await limit.take(fresh, now);
    await store.cleanup(now);
    const hash = (k: string) => createHmac("sha256", env.BETTER_AUTH_SECRET).update(`sliding:teste:${k}`).digest("hex");
    expect(
      await database
        .select()
        .from(attempt)
        .where(eq(attempt.key, hash(old))),
    ).toHaveLength(0);
    expect(
      await database
        .select()
        .from(attempt)
        .where(eq(attempt.key, hash(fresh))),
    ).toHaveLength(1);
  });
});
