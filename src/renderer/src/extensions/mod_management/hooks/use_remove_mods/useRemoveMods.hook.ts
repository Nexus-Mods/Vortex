import { useCallback } from "react";

import { useMainContext } from "@/contexts";
import { activeGameId } from "@/util/selectors";

import { confirmRemoveMods } from "../../util/confirm_remove_mods/confirmRemoveMods";

/**
 * Removes the given mods from the active game once the user confirms, listing each as removing
 * while it is: the new table's Remove, in place of the classic table's.
 */
export const useRemoveMods = () => {
  const { api } = useMainContext();

  return useCallback(
    (modIds: string[]) => confirmRemoveMods(api, activeGameId(api.getState()), modIds),
    [api],
  );
};
