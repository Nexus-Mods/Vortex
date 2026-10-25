/**
 * Small in-memory cache for catalog pages.
 *
 * The Nexus Mods API allows 20 000 requests a day, then 500 an hour. Going back to a page,
 * switching sort orders back and forth or reopening the catalog should not cost requests,
 * so finished pages are kept for a while. Requests still in flight are shared too, so two
 * components asking for the same page at once trigger a single request.
 */
export class CatalogCache<T> {
  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, { at: number; value: T }>();
  readonly #pending = new Map<string, Promise<T>>();

  constructor(options: { ttlMs: number; maxEntries: number; now?: () => number }) {
    this.#ttlMs = options.ttlMs;
    this.#maxEntries = options.maxEntries;
    this.#now = options.now ?? Date.now;
  }

  get(key: string): T | undefined {
    const entry = this.#entries.get(key);
    if (entry === undefined) {
      return undefined;
    }
    if (this.#now() - entry.at > this.#ttlMs) {
      this.#entries.delete(key);
      return undefined;
    }
    // refresh the position so the least recently used entry is evicted first
    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.#entries.delete(key);
    this.#entries.set(key, { at: this.#now(), value });
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.#entries.delete(oldest);
    }
  }

  /** Returns the cached value, or runs `load` once and caches its result. Failures aren't cached. */
  async getOrLoad(key: string, load: () => PromiseLike<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const inFlight = this.#pending.get(key);
    if (inFlight !== undefined) {
      return inFlight;
    }
    const promise = Promise.resolve(load()).then(
      (value) => {
        this.#pending.delete(key);
        this.set(key, value);
        return value;
      },
      (err: unknown) => {
        this.#pending.delete(key);
        throw err;
      },
    );
    this.#pending.set(key, promise);
    return promise;
  }

  clear(): void {
    this.#entries.clear();
  }
}
