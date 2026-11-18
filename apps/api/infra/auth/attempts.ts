import { createHmac, randomUUID } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import database from "infra/database";
import { attempt } from "infra/database/central/schema/attempt";
import env from "infra/env";

/** O que uma regra devolve ao mudar uma chave: o estado novo (`null` apaga), quando ele vence e a resposta. */
export type Change<S, T> = { state: S | null; expiresAt: number; result: T };

/**
 * AD-063: onde a contagem de tentativas fica. `update` lê o estado da chave, aplica `change` e grava, sem
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
 * AD-063: tabela UNLOGGED `attempt` no banco central, comum a todas as instâncias da API. A chave é o HMAC
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

type Entry = { at: number; id: string; pending?: boolean };
type Entries = { entries: Entry[] };

/**
 * RN-ID-07 / AD-064: limite em janela deslizante (no máximo `max` em `windowMs`). O bloqueio do login
 * (RN-ID-04) é outra regra: `login-lockout.ts`.
 */
export class SlidingLimit {
  constructor(
    /**
     * `pendingMs`: uma vaga reservada com `pending` vence nesse tempo, a menos que `confirm` a firme (o
     * pedido caiu sem resposta e não deve ocupar a janela inteira).
     */
    private readonly options: { max: number; windowMs: number; pendingMs?: number },
    private readonly store: AttemptStore = attemptStore,
  ) {}

  private live(state: Entries | null, now: number): Entry[] {
    const pendingMs = this.options.pendingMs ?? this.options.windowMs;
    return (state?.entries ?? []).filter(
      (e) => e.at > now - this.options.windowMs && !(e.pending && e.at <= now - pendingMs),
    );
  }

  private save<T>(entries: Entry[], result: T): Change<Entries, T> {
    if (entries.length === 0) return { state: null, expiresAt: 0, result };
    const last = Math.max(...entries.map((e) => e.at));
    return { state: { entries }, expiresAt: last + this.options.windowMs, result };
  }

  /**
   * Ocupa uma vaga na janela, se houver, de uma vez só (em paralelo, ninguém passa do máximo). Devolve o
   * token da vaga, que `drop` devolve ou `confirm` firma, ou `null` se a janela está cheia.
   */
  reserve(key: string, now: number): Promise<string | null> {
    return this.store.update<Entries, string | null>(`sliding:${key}`, now, (state) => {
      const recent = this.live(state, now);
      if (recent.length >= this.options.max) return this.save(recent, null);
      const id = randomUUID();
      const pending = this.options.pendingMs !== undefined;
      return this.save([...recent, { at: now, id, ...(pending ? { pending } : {}) }], id);
    });
  }

  /** Firma a vaga reservada: ela conta a janela toda. */
  confirm(key: string, token: string, now: number): Promise<void> {
    return this.store.update<Entries, void>(`sliding:${key}`, now, (state) =>
      this.save(
        this.live(state, now).map((e) => (e.id === token ? { at: e.at, id: e.id } : e)),
        undefined,
      ),
    );
  }

  /** Devolve a vaga (o que ela contava não aconteceu). */
  drop(key: string, token: string, now: number): Promise<void> {
    return this.store.update<Entries, void>(`sliding:${key}`, now, (state) =>
      this.save(
        this.live(state, now).filter((e) => e.id !== token),
        undefined,
      ),
    );
  }

  /** Conta uma vez se ainda houver vaga. */
  async take(key: string, now: number): Promise<boolean> {
    return (await this.reserve(key, now)) !== null;
  }
}
