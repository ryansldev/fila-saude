import { LRUCache } from "lru-cache";

type State = { times: number[]; blockedUntil: number | null };

/**
 * RN-ID-04 / RN-ID-07: conta tentativas por chave. Ao chegar ao máximo dentro da janela, bloqueia pela
 * janela inteira (contada da última tentativa); depois do bloqueio, começa do zero. Em memória: a v0.1
 * roda numa instância só (decisão NC5).
 */
export class Attempts {
  private readonly state: LRUCache<string, State>;

  constructor(private readonly options: { max: number; windowMs: number }) {
    this.state = new LRUCache({ max: 100_000 });
  }

  /** O estado vigente: o bloqueio que passou e as tentativas fora da janela somem. */
  private current(key: string, now: number): State {
    const s = this.state.get(key);
    if (!s) return { times: [], blockedUntil: null };
    if (s.blockedUntil !== null && now >= s.blockedUntil) return { times: [], blockedUntil: null };
    return { times: s.times.filter((t) => t > now - this.options.windowMs), blockedUntil: s.blockedUntil };
  }

  blocked(key: string, now: number): boolean {
    return this.current(key, now).blockedUntil !== null;
  }

  /** Conta uma tentativa; a que completa o máximo liga o bloqueio. */
  count(key: string, now: number): void {
    const s = this.current(key, now);
    const times = [...s.times, now];
    const blockedUntil = s.blockedUntil ?? (times.length >= this.options.max ? now + this.options.windowMs : null);
    this.state.set(key, { times, blockedUntil });
  }

  /**
   * Checa e conta de uma vez (sem `await` no meio): pedidos em paralelo não passam todos da checagem.
   * `false` = bloqueado. Quem não era tentativa de verdade devolve com `refund`.
   */
  reserve(key: string, now: number): boolean {
    if (this.blocked(key, now)) return false;
    this.count(key, now);
    return true;
  }

  /** Devolve a última tentativa reservada (o pedido não era uma senha errada). */
  refund(key: string): void {
    const s = this.state.get(key);
    if (!s) return;
    const times = s.times.slice(0, -1);
    this.state.set(key, { times, blockedUntil: times.length >= this.options.max ? s.blockedUntil : null });
  }

  reset(key: string): void {
    this.state.delete(key);
  }
}
