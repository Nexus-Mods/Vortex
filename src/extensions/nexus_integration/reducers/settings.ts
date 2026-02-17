import type { IReducerSpec } from "../../../renderer/types/IExtensionContext";
import { setSafe } from "../../../renderer/util/storeHelper";

import { setAssociatedWithNXMURLs } from "../actions/settings";

/**
 * reducer for changes to the authentication
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [setAssociatedWithNXMURLs as any]: (state, payload) =>
      setSafe(state, ["associateNXM"], payload),
  },
  defaults: {
    associateNXM: undefined,
  },
};
