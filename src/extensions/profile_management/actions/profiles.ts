import safeCreateAction from "../../../actions/safeCreateAction";

/**
 * add or edit a profile
 * @deprecated Use profile:create command via window.api.profile.executeCommand
 */
export const setProfile = safeCreateAction(
  "SET_PROFILE",
  (profile) => profile,
);

/**
 * @deprecated Use profile:remove command via window.api.profile.executeCommand
 */
export const removeProfile = safeCreateAction(
  "REMOVE_PROFILE",
  (profileId) => profileId,
);

export const willRemoveProfile = safeCreateAction(
  "WILL_REMOVE_PROFILE",
  (profileId) => profileId,
);

/**
 * @deprecated Use profile:set-mod-enabled command via window.api.profile.executeCommand
 */
export const setModEnabled = safeCreateAction(
  "SET_MOD_ENABLED",
  (profileId: string, modId: string, enable: boolean) => ({
    profileId,
    modId,
    enable,
  }),
);

/**
 * @deprecated Use profile:forget-mod command via window.api.profile.executeCommand
 */
export const forgetMod = safeCreateAction(
  "FORGET_PROFILE_MOD",
  (profileId: string, modId: string) => ({ profileId, modId }),
);

/**
 * @deprecated Use profile:set-feature command via window.api.profile.executeCommand
 */
export const setFeature = safeCreateAction(
  "SET_PROFILE_FEATURE",
  (profileId: string, featureId: string, value: any) => ({
    profileId,
    featureId,
    value,
  }),
);

/**
 * @deprecated Use profile:set-activated command via window.api.profile.executeCommand
 */
export const setProfileActivated = safeCreateAction(
  "SET_PROFILE_ACTIVATED",
  (active: string) => active,
);

export interface IEnableOptions {
  installed?: boolean;
  allowAutoDeploy?: boolean;
  willBeReplaced?: boolean;
}
