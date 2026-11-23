import safeCreateAction from "../../../actions/safeCreateAction";
import type { IValidateKeyDataV2 } from "../types/IValidateKeyData";

/**
 * action to set the user info nexus associates with an api key
 */
export const setUserInfo = safeCreateAction(
  "SET_USER_INFO",
  (info: IValidateKeyDataV2 | undefined) => info,
);

/**
 * remember current version available on nexus
 */
export const setNewestVersion = safeCreateAction(
  "SET_NEWEST_VERSION",
  (version: string | undefined) => version,
);
