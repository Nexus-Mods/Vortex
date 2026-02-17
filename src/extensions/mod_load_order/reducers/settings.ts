import type { IReducerSpec } from "../../../renderer/types/IExtensionContext";
import { setSafe } from "../../../renderer/util/storeHelper";

import * as actions from "../actions/settings";

export const loadOrderSettingsReducer: IReducerSpec = {
  reducers: {
    [actions.setGameLoadOrderRendererOptions as any]: (state, payload) => {
      const { gameId, itemRendererOptions } = payload;
      return setSafe(state, ["rendererOptions", gameId], itemRendererOptions);
    },
  },
  defaults: {},
};
