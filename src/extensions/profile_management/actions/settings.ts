import safeCreateAction from "../../../actions/safeCreateAction";

/**
 * change current profile
 * this must only be used by profile_management internally!
 */
export const setCurrentProfile = safeCreateAction(
  "SET_CURRENT_PROFILE",
  (gameId: string, profileId: string) => ({ gameId, profileId }),
);

/**
 * @deprecated Use profile:switch command via window.api.profile.executeCommand
 */
export const setNextProfile = safeCreateAction(
  "SET_NEXT_PROFILE",
  (profileId: string) => ({ profileId }),
);

/**
 * clear the last known active profile for the specified game.
 * this should also only be called by profile_management internally.
 */
export const clearLastActiveProfile = safeCreateAction(
  "CLEAR_LAST_ACTIVE_PROFILE",
  (gameId: string) => ({ gameId }),
);
