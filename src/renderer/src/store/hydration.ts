/**
 * Renderer-side hydration utilities.
 *
 * This module handles fetching persisted state from the main process
 * via the preload API and constructing the initial Redux state.
 */

import type { IState } from "../types/IState";

import { log } from "../logging";
import { addPersistedHives } from "./persistDiffMiddleware";

/**
 * Fetch hydration data from main process via preload API.
 * Returns the persisted state hives (settings, persistent, user, confidential).
 * Session state is not persisted and will be initialized by reducers.
 *
 * @returns Promise resolving to the hydrated state (partial, without session)
 */
export async function fetchHydrationState(): Promise<Partial<IState>> {
  // Check if preload API is available
  if (typeof window === "undefined" || !window.api?.persist) {
    log("warn", "Preload persist API not available, using empty state");
    return {};
  }

  try {
    log("debug", "Fetching hydration data from main process");
    const hydrationData = await window.api.persist.getHydration();

    const discoveredHives = Object.keys(hydrationData);
    log("debug", "Received hydration data", {
      hives: discoveredHives,
    });

    // Register discovered hives with the persistence middleware
    // This ensures any hives found in LevelDB will be tracked for future changes
    addPersistedHives(discoveredHives);

    // Return hydration data directly - reducers will handle defaults for missing keys
    // Cast through unknown: IPC returns Serializable, but we know it conforms to IState
    return hydrationData as unknown as Partial<IState>;
  } catch (err) {
    log("error", "Failed to fetch hydration data", { error: err });
    return {};
  }
}

/**
 * Set up listeners for state updates pushed from the main process:
 * - persist:hydrate — incremental hydration of a full hive after initial load
 * - persist:push — surgical diff operations from direct main-process LevelDB writes
 *
 * __persist_push is excluded from persistDiffMiddleware to prevent feedback loops.
 *
 * @param dispatch - Redux store dispatch function
 */
export function setupHydrationListener(
  dispatch: (action: { type: string; payload: unknown }) => void,
): void {
  if (typeof window === "undefined" || !window.api?.persist) {
    return;
  }

  window.api.persist.onHydrate((hive, data) => {
    log("debug", "Received incremental hydration", { hive });
    // Register this hive for persistence tracking
    addPersistedHives([hive]);
    dispatch({
      type: "__hydrate",
      payload: { [hive]: data },
    });
  });

  window.api.persist.onPush((hive, operations) => {
    log("debug", "Received state push from main", { hive, count: operations.length });
    dispatch({
      type: "__persist_push",
      payload: { hive, operations },
    });
  });
}
