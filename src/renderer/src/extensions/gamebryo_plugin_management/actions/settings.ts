import { createAction } from "redux-act";

export const setBetaLoadOrder = createAction(
  "GAMEBRYO_SET_BETA_LOAD_ORDER",
  (profileId: string, enabled: boolean) => ({ profileId, enabled }),
);

/**
 * enables or disables autosort
 */
export const setAutoSortEnabled = createAction(
  "GAMEBRYO_SET_AUTOSORT_ENABLED",
  (enabled: boolean) => enabled,
);

export const setAutoEnable = createAction("GAMEBRYO_SET_AUTO_ENABLE", (enable: boolean) => enable);

export const setPluginManagementEnabled = createAction(
  "GAMEBRYO_SET_PLUGIN_MANAGEMENT_ENABLED",
  (profileId: string, enabled: boolean) => ({ profileId, enabled }),
);
