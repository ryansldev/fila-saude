import { LRUCache } from "lru-cache";

/**
 * RN-ID-04 / RN-ID-07: conta tentativas por chave numa janela; passou do máximo, fica bloqueada até a
 * janela da primeira tentativa vencer. Em memória: a v0.1 roda numa instância só (decisão NC5).
 */
export class Attempts {
  private readonly times: LRUCache<string, number[]>;

  constructor(private readonly options: { max: number; windowMs: number }) {
    this.times = new LRUCache({ max: 100_000 });
  }

  private recent(key: string, now: number): number[] {
    return (this.times.get(key) ?? []).filter((t) => t > now - this.options.windowMs);
  }

  blocked(key: string, now: number): boolean {
    return this.recent(key, now).length >= this.options.max;
  }

  count(key: string, now: number): void {
    this.times.set(key, [...this.recent(key, now), now]);
  }

  reset(key: string): void {
    this.times.delete(key);
  }
}
