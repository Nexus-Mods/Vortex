/** Per-game change keys of the store_game_version telemetry, persisted so a
    second Vortex session with unchanged installs sends nothing. */
export interface IStoreGameVersionCacheEntry {
  /** Cheap gate computed without the exe version lookup; null after a failed
      lookup, so the next emit retries it. */
  stableKey: string | null;
  /** Full change key of the payload from the last successful send. */
  fullKey: string;
}
