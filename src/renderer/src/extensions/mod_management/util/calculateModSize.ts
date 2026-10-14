import * as path from "path";

import type { Store } from "redux";

import { log } from "@/logging";
import type { IState } from "@/types/IState";
import calculateFolderSize from "@/util/calculateFolderSize";

import { setModAttribute } from "../actions/mods";
import { installPathForGame } from "../selectors";

/**
 * Works out an installed mod's size, the total of the files in its staging folder, and keeps
 * it on the mod as `modSize`. Never rejects: a mod it can't size keeps the size it had.
 */
export const calculateModSize = (
  store: Pick<Store<IState>, "getState" | "dispatch">,
  gameId: string,
  modId: string,
): Promise<void> => {
  const state = store.getState();
  const mod = state.persistent.mods[gameId]?.[modId];
  if (mod?.installationPath === undefined) {
    log("debug", "failed to calculate modSize", "mod is not in state");
    return Promise.resolve();
  }

  const modPath = path.join(installPathForGame(state, gameId), mod.installationPath);
  return calculateFolderSize(modPath)
    .then((totalSize) => {
      store.dispatch(setModAttribute(gameId, modId, "modSize", totalSize));
    })
    .catch((err) => {
      log("debug", "failed to calculate modSize", err);
    });
};
