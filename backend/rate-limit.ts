// In-memory rate limiter, fixed window per key (IP). Enough for a single process (D-010).
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  private lastPrune = 0;

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private now: () => number = Date.now,
  ) {}

  private prune(t: number): void {
    if (t - this.lastPrune < this.windowMs && this.hits.size < 10_000) return;
    this.lastPrune = t;
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }

  private entry(key: string, t: number) {
    const e = this.hits.get(key);
    return e && e.resetAt > t ? e : undefined;
  }

  /** Counts a call. `ok:false` if the window limit is exceeded. */
  hit(key: string): { ok: boolean; retryAfterSec: number } {
    const t = this.now();
    this.prune(t);
    let e = this.entry(key, t);
    if (!e) {
      e = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, e);
    }
    e.count++;
    return { ok: e.count <= this.limit, retryAfterSec: Math.max(1, Math.ceil((e.resetAt - t) / 1000)) };
  }

  /** True if the key has already reached the limit (without counting one more call). */
  blocked(key: string): { blocked: boolean; retryAfterSec: number } {
    const t = this.now();
    const e = this.entry(key, t);
    return { blocked: !!e && e.count >= this.limit, retryAfterSec: e ? Math.max(1, Math.ceil((e.resetAt - t) / 1000)) : 0 };
  }
}
