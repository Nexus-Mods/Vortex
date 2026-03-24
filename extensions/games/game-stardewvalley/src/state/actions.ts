/**
 * Defines Redux actions for Stardew Valley settings state updates.
 */
import { createAction } from "redux-act";

/**
 * Sets whether dependency recommendations should be shown for SDV mods.
 */
export const setRecommendations = createAction(
  "SET_SDV_RECOMMENDATIONS",
  (enabled: boolean) => enabled,
);

/**
 * Sets whether config-file merge support is enabled for a profile.
 */
export const setMergeConfigs = createAction(
  "SET_SDV_MERGE_CONFIGS",
  (profileId: string, enabled: boolean) => ({ profileId, enabled }),
);
