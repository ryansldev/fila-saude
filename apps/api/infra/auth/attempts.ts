import { LRUCache } from "lru-cache";

/** Quanto uma reserva vale sem resposta (o pedido caiu antes do hook `after`). */
const RESERVATION_MS = 30_000;

type Options = {
  max: number;
  windowMs: number;
  /** Ao chegar ao máximo, bloqueia pela janela inteira (login, RN-ID-04). Sem isso, janela deslizante. */
  lockout?: boolean;
};

/**
 * RN-ID-04 / RN-ID-07: conta tentativas por chave, em memória (a v0.1 roda numa instância só,
 * decisão NC5). Os bloqueios ficam num cache à parte e maior: encher o de contagens com chaves
 * novas não tira ninguém do bloqueio.
 */
export class Attempts {
  private readonly times = new LRUCache<string, number[]>({ max: 100_000 });
  private readonly pending = new LRUCache<string, number[]>({ max: 100_000 });
  private readonly blockedUntil = new LRUCache<string, number>({ max: 1_000_000 });

  constructor(private readonly options: Options) {}

  private recent(key: string, now: number): number[] {
    return (this.times.get(key) ?? []).filter((t) => t > now - this.options.windowMs);
  }

  private live(key: string, now: number): number[] {
    return (this.pending.get(key) ?? []).filter((t) => t > now - RESERVATION_MS);
  }

  blocked(key: string, now: number): boolean {
    if (!this.options.lockout) return this.recent(key, now).length >= this.options.max;
    const until = this.blockedUntil.get(key);
    if (until === undefined) return false;
    if (now < until) return true;
    this.blockedUntil.delete(key);
    this.times.delete(key);
    return false;
  }

  /** Conta uma tentativa; com `lockout`, a que completa o máximo liga o bloqueio. */
  count(key: string, now: number): void {
    if (this.blocked(key, now)) return;
    const times = [...this.recent(key, now), now];
    this.times.set(key, times);
    if (this.options.lockout && times.length >= this.options.max) {
      this.blockedUntil.set(key, now + this.options.windowMs);
    }
  }

  /**
   * Ocupa uma vaga enquanto o pedido corre (sem `await` entre checar e ocupar): pedidos em paralelo
   * não passam todos. Não liga o bloqueio; só `fail` conta. `null` = sem vaga.
   */
  reserve(key: string, now: number): boolean {
    if (this.blocked(key, now)) return false;
    const live = this.live(key, now);
    if (this.recent(key, now).length + live.length >= this.options.max) return false;
    this.pending.set(key, [...live, now]);
    return true;
  }

  /** Solta uma reserva sem contar (acertou, pedido inválido, erro do servidor). */
  release(key: string): void {
    const live = this.pending.get(key) ?? [];
    if (live.length > 0) this.pending.set(key, live.slice(1));
  }

  /** A reserva era uma senha errada: conta. */
  fail(key: string, now: number): void {
    this.release(key);
    this.count(key, now);
  }

  /** Acertou: solta a reserva do pedido e zera a contagem. */
  reset(key: string): void {
    this.release(key);
    this.times.delete(key);
    this.blockedUntil.delete(key);
  }
}
