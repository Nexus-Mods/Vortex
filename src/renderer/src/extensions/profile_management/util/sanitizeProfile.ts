import type * as Redux from "redux";

import { log } from "../../../logging";
import type { IState } from "../../../types/IState";
import { batchDispatch } from "../../../util/util";
import { forgetMod } from "../actions/profiles";
import type { IProfile } from "../types/IProfile";

/**
 * Drops the profile's state for mods that are no longer installed.
 *
 * The enabled flags live only here, so a wrong call is unrecoverable. Removing
 * every mod leaves the game's table behind as an empty one, so a table that is
 * absent entirely never loaded and is not something to reconcile against
 * (GH#23981).
 */
export function sanitizeProfile(store: Redux.Store<IState>, profile: IProfile): void {
  const modState = profile.modState ?? {};
  const trackedIds = Object.keys(modState);
  if (trackedIds.length === 0) {
    return;
  }

  const state = store.getState();
  const knownMods = state.persistent.mods?.[profile.gameId];

  if (knownMods === undefined) {
    log("error", "no mod table for game, keeping profile mod state", {
      profile: profile.id,
      game: profile.gameId,
      keptEntries: trackedIds.length,
    });
    return;
  }

  const missing = trackedIds.filter((modId) => knownMods[modId] === undefined);
  if (missing.length === 0) {
    return;
  }

  missing.forEach((modId) => {
    log("debug", "removing info of missing mod from profile", {
      profile: profile.id,
      game: profile.gameId,
      modId,
    });
  });
  batchDispatch(
    store,
    missing.map((modId) => forgetMod(profile.id, modId)),
  );
}
