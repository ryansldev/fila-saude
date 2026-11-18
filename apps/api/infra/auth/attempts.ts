import { LRUCache } from "lru-cache";

/** Quanto uma reserva vale sem resposta (o pedido caiu antes do hook `after`). */
const RESERVATION_MS = 30_000;

type Options = {
  max: number;
  windowMs: number;
  /** Ao chegar ao máximo, bloqueia pela janela inteira (login, RN-ID-04). Sem isso, janela deslizante. */
  lockout?: boolean;
};

type Reservation = { id: number; at: number };

/**
 * RN-ID-04 / RN-ID-07: conta tentativas por chave, em memória (a v0.1 roda numa instância só,
 * decisão NC5). Os caches são grandes (1 milhão de chaves) e os bloqueios ficam num à parte:
 * para expulsar a contagem de alguém, seria preciso 1 milhão de logins com chaves novas.
 */
export class Attempts {
  private readonly times = new LRUCache<string, number[]>({ max: 1_000_000 });
  private readonly pending = new LRUCache<string, Reservation[]>({ max: 100_000 });
  private readonly blockedUntil = new LRUCache<string, number>({ max: 1_000_000 });
  private next = 0;

  constructor(private readonly options: Options) {}

  private recent(key: string, now: number): number[] {
    return (this.times.get(key) ?? []).filter((t) => t > now - this.options.windowMs);
  }

  private live(key: string, now: number): Reservation[] {
    return (this.pending.get(key) ?? []).filter((r) => r.at > now - RESERVATION_MS);
  }

  private setPending(key: string, list: Reservation[]): void {
    if (list.length === 0) this.pending.delete(key);
    else this.pending.set(key, list);
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
   * não passam todos. Não liga o bloqueio; só `fail` conta. Devolve o token da reserva, `"blocked"`
   * (bloqueado de fato) ou `"busy"` (as vagas estão com pedidos que ainda correm).
   */
  reserve(key: string, now: number): number | "blocked" | "busy" {
    if (this.blocked(key, now)) return "blocked";
    const live = this.live(key, now);
    if (this.recent(key, now).length + live.length >= this.options.max) {
      this.setPending(key, live);
      return "busy";
    }
    const id = ++this.next;
    this.pending.set(key, [...live, { id, at: now }]);
    return id;
  }

  /** Solta a própria reserva sem contar (pedido inválido, erro do servidor). */
  release(key: string, token: number): void {
    this.setPending(
      key,
      (this.pending.get(key) ?? []).filter((r) => r.id !== token),
    );
  }

  /** A reserva era uma senha errada: conta. */
  fail(key: string, token: number, now: number): void {
    this.release(key, token);
    this.count(key, now);
  }

  /** Acertou: solta a reserva do pedido e zera a contagem. */
  reset(key: string, token: number): void {
    this.release(key, token);
    this.times.delete(key);
    this.blockedUntil.delete(key);
  }
}
