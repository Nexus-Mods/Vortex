/**
 * A game installation detected by a store scanner.
 */
export interface IStoreGameEntry {
  storeId: string;
  installPath: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Interface for store-specific game discovery scanners.
 *
 * Each scanner is a pure data producer: it scans its store and reports
 * what it finds. It knows nothing about Vortex game definitions —
 * the matching happens elsewhere.
 */
export interface IStoreScanner {
  /** Unique identifier for this store (e.g. "steam", "gog", "epic") */
  readonly storeType: string;

  /** Scan the store and return all detected game installations. */
  scan(): Promise<IStoreGameEntry[]>;

  /** Check if this store is installed / available on this system. */
  isAvailable(): Promise<boolean>;
}
