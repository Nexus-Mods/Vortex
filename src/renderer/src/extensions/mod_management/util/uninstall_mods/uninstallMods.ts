import type { VortexGameId } from "@vortex/shared";

import { startActivity, stopActivity } from "@/actions/session";
import type { IExtensionApi } from "@/types/IExtensionContext";

import { removeMods } from "../removeMods";
import { reportRemovalFailure } from "../report_removal_failure/reportRemovalFailure";

/**
 * The activity group each mod being uninstalled is listed in, by id, for its row to show it.
 * A group of its own: anything in "mods" reads as the whole app being busy.
 */
export const UNINSTALLING_ACTIVITY = "mods-uninstalling";

/**
 * Uninstalls mods from a game, keeping their archives so they can be installed again, listing
 * each as uninstalling while it is. A cancel says nothing, a removal that can't go ahead warns,
 * and any other failure is reported unless it says it isn't worth it. Never rejects: resolves to
 * whether it finished, for callers that do more once the mods are gone.
 */
export const uninstallMods = async (
  api: IExtensionApi,
  gameId: VortexGameId,
  modIds: string[],
): Promise<boolean> => {
  modIds.forEach((modId) => api.store?.dispatch(startActivity(UNINSTALLING_ACTIVITY, modId)));

  try {
    await removeMods(api, gameId, modIds);
    return true;
  } catch (err) {
    reportRemovalFailure(api, "Failed to uninstall mods", err);
    return false;
  } finally {
    modIds.forEach((modId) => api.store?.dispatch(stopActivity(UNINSTALLING_ACTIVITY, modId)));
  }
};
