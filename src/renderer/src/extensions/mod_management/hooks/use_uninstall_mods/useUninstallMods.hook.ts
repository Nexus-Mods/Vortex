import { useCallback } from "react";

import { startActivity, stopActivity } from "@/actions/session";
import { useMainContext } from "@/contexts";
import { ProcessCanceled, UserCanceled } from "@/util/CustomErrors";
import { activeGameId } from "@/util/selectors";

import { removeMods } from "../../util/removeMods";

/**
 * The activity group each mod being uninstalled is listed in, by id, for its row to show it.
 * A group of its own: anything in "mods" reads as the whole app being busy.
 */
export const UNINSTALLING_ACTIVITY = "mods-uninstalling";

/**
 * Uninstalls the given mods, keeping their archives so they can be installed again: the
 * legacy table's "Uninstalled" status, for the mods it's asked about.
 */
export const useUninstallMods = () => {
  const { api } = useMainContext();

  return useCallback(
    async (modIds: string[]) => {
      modIds.forEach((modId) => api.store?.dispatch(startActivity(UNINSTALLING_ACTIVITY, modId)));

      try {
        await removeMods(api, activeGameId(api.getState()), modIds);
      } catch (err) {
        if (err instanceof UserCanceled) {
          return;
        }

        if (err instanceof ProcessCanceled) {
          api.sendNotification({
            id: "cant-remove-mod",
            type: "warning",
            title: "Failed to uninstall mods",
            message: err.message,
          });
          return;
        }

        // A corrupt manifest says it isn't worth reporting, as the legacy table heeded.
        api.showErrorNotification("Failed to uninstall mods", err, {
          allowReport: (err as { allowReport?: boolean })?.allowReport !== false,
        });
      } finally {
        modIds.forEach((modId) => api.store?.dispatch(stopActivity(UNINSTALLING_ACTIVITY, modId)));
      }
    },
    [api],
  );
};
