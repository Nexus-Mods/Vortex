import type { IReducerSpec } from "../../../renderer/types/IExtensionContext";
import { setSafe } from "../../../renderer/util/storeHelper";

import * as actions from "../actions/sandbox";

export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setInstallerSandbox as any]: (state, payload) =>
      setSafe(state, ["installerSandbox"], payload),
  },
  defaults: {
    installerSandbox: true,
  },
};
