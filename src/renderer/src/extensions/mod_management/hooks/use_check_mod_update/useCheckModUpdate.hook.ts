import { useCallback } from "react";

import { useMainContext } from "@/contexts";

import { checkModUpdates } from "../../util/check_mod_updates/checkModUpdates";

/** The legacy table's Check for Update, for the mods it's asked about; see checkModUpdates. */
export const useCheckModUpdate = () => {
  const { api } = useMainContext();

  return useCallback((modIds: string[]) => checkModUpdates(api, modIds), [api]);
};
