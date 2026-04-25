/**
 * Lightweight in-process TTL cache
 *
 * Used to reduce repeated identical DB hits for hot read paths:
 *   - Individual user lookups  (TTL: 30s)
 *   - All-users list           (TTL: 15s)
 *   - Individual room lookups  (TTL: 10s)
 *   - YouTube featured videos  (TTL: 5min)
 *   - GIF trending results     (TTL: 5min)
 *
 * The cache is invalidated on writes so stale data is never served.
 * This is a process-local cache — not shared across multiple instances.
 */

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<V> {
  private store = new Map<string, CacheEntry<V>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private defaultTtlMs: number, cleanupIntervalMs = 60_000) {
    this.cleanupInterval = setInterval(() => this.evictExpired(), cleanupIntervalMs);
    this.cleanupInterval.unref();
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: V, ttlMs?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  deletePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }
}

export const userCache   = new TtlCache<any>(30_000);
export const roomCache   = new TtlCache<any>(10_000);
export const externalCache = new TtlCache<any>(5 * 60_000);
