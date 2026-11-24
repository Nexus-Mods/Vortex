import { useCallback } from "react";

import { useMainContext } from "@/contexts";
import { activeGameId } from "@/util/selectors";

import { uninstallMods } from "../../util/uninstall_mods/uninstallMods";

/**
 * Uninstalls the given mods from the active game, keeping their archives so they can be installed
 * again: the legacy table's "Uninstalled" status, for the mods it's asked about.
 */
export const useUninstallMods = () => {
  const { api } = useMainContext();

  return useCallback(
    (modIds: string[]) => uninstallMods(api, activeGameId(api.getState()), modIds),
    [api],
  );
};
