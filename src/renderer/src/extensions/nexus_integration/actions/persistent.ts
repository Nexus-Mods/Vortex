import { createAction } from "redux-act";

import type { IValidateKeyDataV2 } from "../types/IValidateKeyData";

/**
 * action to set the user info nexus associates with an api key
 */
export const setUserInfo = createAction("SET_USER_INFO", (input: IValidateKeyDataV2) => input);

/**
 * remember current version available on nexus
 */
export const setNewestVersion = createAction("SET_NEWEST_VERSION", (input: string) => input);
