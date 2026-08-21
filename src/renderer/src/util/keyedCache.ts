/** Minimal in-memory cache keyed by string with a per-entry TTL. */
export interface KeyedCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  /** Drop every entry, for when something outside the cache invalidates all of them at once. */
  clear(): void;
}

/** Create a keyed cache whose entries expire `ttlMs` after they are set. */
export function createKeyedCache<V>(ttlMs: number): KeyedCache<V> {
  const entries = new Map<string, { value: V; expires: number }>();

  return {
    get(key) {
      const entry = entries.get(key);
      if (entry === undefined) {
        return undefined;
      }
      if (entry.expires <= Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      entries.set(key, { value, expires: Date.now() + ttlMs });
    },
    clear() {
      entries.clear();
    },
  };
}
