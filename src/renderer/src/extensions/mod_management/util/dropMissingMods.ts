import type { IExtensionApi } from "../../../types/IExtensionContext";
import { removeMod } from "../actions/mods";
import type { IMod } from "../types/IMod";

const IN_FLIGHT_STATES: ReadonlySet<string> = new Set(["downloading", "installing"]);

/**
 * Whether a mod record whose staging folder is gone may be dropped from state.
 */
export function canDropMissingMod(mod: IMod | undefined): boolean {
  if (mod === undefined) {
    return false;
  }
  return !IN_FLIGHT_STATES.has(mod.state);
}

/**
 * Drops the state entries for mods that `refreshMods` found missing from the
 * staging folder. Wired as its `onRemoveMods` callback.
 */
export function dropMissingMods(
  api: IExtensionApi,
  gameId: string,
  // keyed by modId
  knownMods: Record<string, IMod>,
  modNames: string[],
): void {
  modNames.forEach((modId) => {
    if (canDropMissingMod(knownMods[modId])) {
      api.store.dispatch(removeMod(gameId, modId));
    }
  });
}
