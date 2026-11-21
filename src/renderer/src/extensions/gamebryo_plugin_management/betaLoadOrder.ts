import { VortexGameId } from "@vortex/shared";

import type { IState } from "../../types/IState";
import { activeProfile } from "../profile_management/selectors";
import { knownGame } from "./util/gameSupport";

export function supportsBetaLoadOrder(gameId: VortexGameId | undefined): boolean {
  return (
    gameId !== undefined &&
    gameId !== "starfield" &&
    gameId !== "oblivionremastered" &&
    knownGame(gameId)
  );
}

export function isBetaLoadOrder(state: IState, profile = activeProfile(state)): boolean {
  return (
    state.settings.plugins?.betaLoadOrder?.[profile?.id] === true &&
    supportsBetaLoadOrder(profile?.gameId ? VortexGameId(profile.gameId) : undefined)
  );
}

/** The existing writer also controls file timestamps when the user orders plugins in Beta. */
export function controlsPluginOrder(state: IState): boolean {
  return state.settings.plugins.autoSort || isBetaLoadOrder(state);
}
