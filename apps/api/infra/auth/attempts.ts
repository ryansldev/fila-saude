import { LRUCache } from "lru-cache";

/**
 * RN-ID-07: limite em janela deslizante (no máximo `max` em `windowMs`), em memória (a v0.1 roda numa
 * instância só, decisão NC5). O bloqueio do login (RN-ID-04) é outra regra: `login-lockout.ts`.
 */
export class SlidingLimit {
  private readonly times = new LRUCache<string, number[]>({ max: 100_000 });

  constructor(private readonly options: { max: number; windowMs: number }) {}

  private recent(key: string, now: number): number[] {
    return (this.times.get(key) ?? []).filter((t) => t > now - this.options.windowMs);
  }

  blocked(key: string, now: number): boolean {
    return this.recent(key, now).length >= this.options.max;
  }

  count(key: string, now: number): void {
    this.times.set(key, [...this.recent(key, now), now]);
  }
}
