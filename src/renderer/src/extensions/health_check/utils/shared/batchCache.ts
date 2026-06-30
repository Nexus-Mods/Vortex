/**
 * Helpers for chunked, cached batch fetching: split id lists into request-sized
 * chunks, and memoize fetched rows by key so re-runs (e.g. on ModsChanged) only
 * fetch what isn't already cached. Shared by the mod- and file-level checks.
 */

/** Yield `items` in successive chunks of at most `size`. */
export function* chunked<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) {
    yield items.slice(i, i + size);
  }
}

/** Minimal in-memory cache keyed by string with a per-entry TTL. */
export interface KeyedCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
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
  };
}

/**
 * Resolve `keys` through `cache`, fetching only the misses via `fetchMissing`
 * and caching whatever it returns. Keys that `fetchMissing` omits are simply
 * absent from the result (and stay uncached, so they are retried next time).
 */
export async function resolveCached<V>(
  keys: string[],
  cache: KeyedCache<V>,
  fetchMissing: (missing: string[]) => Promise<Map<string, V>>,
): Promise<Map<string, V>> {
  const resolved = new Map<string, V>();
  const missing: string[] = [];

  for (const key of new Set(keys)) {
    const cached = cache.get(key);
    if (cached === undefined) {
      missing.push(key);
    } else {
      resolved.set(key, cached);
    }
  }

  if (missing.length > 0) {
    const fetched = await fetchMissing(missing);
    for (const [key, value] of fetched) {
      cache.set(key, value);
      resolved.set(key, value);
    }
  }

  return resolved;
}
