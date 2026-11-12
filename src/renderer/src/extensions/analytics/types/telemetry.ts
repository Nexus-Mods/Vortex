/** Per-game change keys of the store_game_version telemetry, persisted so a
    second Vortex session with unchanged installs sends nothing. */
export interface IStoreGameVersionCacheEntry {
  /** Cheap gate computed without the exe version lookup; null after a failed
      lookup, so the next emit retries it. */
  stableKey: string | null;
  /** Full change key of the payload from the last successful send. */
  fullKey: string;
}

/** Per-game state of the game folder check (MOD-80), persisted so each game is checked once.
    A check stays pending until its result is sent; a cancelled or failed one runs again. */
export type IGameFolderCheckMarker =
  | { state: "pending"; managedAt: number }
  | { state: "done"; status: string; at: number };
