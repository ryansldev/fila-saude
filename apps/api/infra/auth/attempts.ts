import { createHmac } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import database from "infra/database";
import { attempt } from "infra/database/central/schema/attempt";
import env from "infra/env";

/** O que uma regra devolve ao mudar uma chave: o estado novo (`null` apaga), quando ele vence e a resposta. */
export type Change<S, T> = { state: S | null; expiresAt: number; result: T };

/**
 * NC5: onde a contagem de tentativas fica. `update` lê o estado da chave, aplica `change` e grava, sem
 * outro pedido mexer na mesma chave no meio (é o que segura pedidos em paralelo). Estado vencido chega
 * como `null`.
 */
export interface AttemptStore {
  update<S, T>(key: string, now: number, change: (state: S | null) => Change<S, T>): Promise<T>;
}

/** Em memória, para os testes de unidade das regras (o `change` é síncrono, então já é atômico). */
export class MemoryStore implements AttemptStore {
  private readonly rows = new Map<string, { state: unknown; expiresAt: number }>();

  async update<S, T>(key: string, now: number, change: (state: S | null) => Change<S, T>): Promise<T> {
    const row = this.rows.get(key);
    const r = change(row && row.expiresAt > now ? (row.state as S) : null);
    if (r.state === null) this.rows.delete(key);
    else this.rows.set(key, { state: r.state, expiresAt: r.expiresAt });
    return r.result;
  }
}

// De quanto em quanto tempo uma instância apaga as linhas vencidas, aproveitando um pedido.
const CLEANUP_EVERY_MS = 10 * 60_000;

/** Onde vão os erros da contagem que não podem derrubar o pedido (o app troca pelo log do Fastify). */
export const attemptErrors = {
  log: (error: unknown, what: string): void => console.error(what, error),
};

/**
 * NC5: tabela UNLOGGED `attempt` no banco central, comum a todas as instâncias da API. A chave é o HMAC
 * (com o segredo da API) de CPF, login ou IP, nunca o valor. Cada mudança é uma transação curta: um só
 * `insert … on conflict do update … returning` cria ou trava a linha e a lê, então nenhuma outra
 * transação a apaga no meio. Pedidos da mesma chave na mesma instância esperam em fila aqui, e não
 * segurando conexões do pool (uma rajada num CPF não trava o banco central para os outros).
 */
export class PostgresStore implements AttemptStore {
  private lastCleanup = 0;
  private readonly queues = new Map<string, Promise<void>>();

  private hash(key: string): string {
    return createHmac("sha256", env.BETTER_AUTH_SECRET).update(key).digest("hex");
  }

  async update<S, T>(key: string, now: number, change: (state: S | null) => Change<S, T>): Promise<T> {
    const hashed = this.hash(key);
    const run = (this.queues.get(hashed) ?? Promise.resolve()).then(() => this.write(hashed, now, change));
    const tail = run.then(
      () => {},
      () => {},
    );
    this.queues.set(hashed, tail);
    void tail.then(() => {
      if (this.queues.get(hashed) === tail) this.queues.delete(hashed);
    });
    const result = await run;
    if (now - this.lastCleanup > CLEANUP_EVERY_MS) {
      this.lastCleanup = now;
      // Fora do pedido: uma falha na limpeza não derruba o login, mas fica no log.
      this.cleanup(now).catch((error) => attemptErrors.log(error, "limpeza das tentativas"));
    }
    return result;
  }

  private write<S, T>(hashed: string, now: number, change: (state: S | null) => Change<S, T>): Promise<T> {
    return database.transaction(async (tx) => {
      // Outra instância segurando a linha por mais que isso é defeito: o pedido falha em vez de esperar.
      await tx.execute(sql`set local lock_timeout = '2s'`);
      const [row] = await tx
        .insert(attempt)
        .values({ key: hashed, state: {}, expiresAt: new Date(0) })
        .onConflictDoUpdate({ target: attempt.key, set: { key: sql`excluded.key` } })
        .returning();
      const live = row && row.expiresAt.getTime() > now ? (row.state as S) : null;
      const r = change(live);
      if (r.state === null) await tx.delete(attempt).where(eq(attempt.key, hashed));
      else
        await tx
          .update(attempt)
          .set({ state: r.state, expiresAt: new Date(r.expiresAt) })
          .where(eq(attempt.key, hashed));
      return r.result;
    });
  }

  /** Apaga as linhas vencidas (a LGPD pede que a chave não fique mais que o necessário). */
  async cleanup(now: number): Promise<void> {
    await database.delete(attempt).where(lt(attempt.expiresAt, new Date(now)));
  }
}

/** Armazenamento da API (o Postgres); os testes de unidade passam um `MemoryStore`. */
export const attemptStore: AttemptStore = new PostgresStore();

type Times = { times: number[] };

/**
 * RN-ID-07: limite em janela deslizante (no máximo `max` em `windowMs`). O bloqueio do login (RN-ID-04)
 * é outra regra: `login-lockout.ts`.
 */
export class SlidingLimit {
  constructor(
    private readonly options: { max: number; windowMs: number },
    private readonly store: AttemptStore = attemptStore,
  ) {}

  /** Conta uma vez se ainda houver vaga, de uma vez só (em paralelo, ninguém passa do máximo). */
  take(key: string, now: number): Promise<boolean> {
    return this.store.update<Times, boolean>(`sliding:${key}`, now, (state) => {
      const recent = (state?.times ?? []).filter((t) => t > now - this.options.windowMs);
      const last = recent.at(-1) ?? now;
      if (recent.length >= this.options.max)
        return { state: { times: recent }, expiresAt: last + this.options.windowMs, result: false };
      return { state: { times: [...recent, now] }, expiresAt: now + this.options.windowMs, result: true };
    });
  }
}
