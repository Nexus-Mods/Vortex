import { types, util } from "@nexusmods/vortex-api";

import {
  autoSortLoadOrderChanged,
  setRemasterNoticeSeen,
  setSuppressModLimitPatch,
} from "./actions";

// reducer
export const W3Reducer: types.IReducerSpec = {
  reducers: {
    [setSuppressModLimitPatch as any]: (state, payload) => {
      return util.setSafe(state, ["suppressModLimitPatch"], payload);
    },
    [setRemasterNoticeSeen as any]: (state, payload) => {
      return util.setSafe(state, ["remasterNoticeSeen"], payload);
    },
    [autoSortLoadOrderChanged as any]: (state, payload) => ({
      ...state,
      autoSortLoadOrder: payload,
    }),
  },
  defaults: {
    suppressModLimitPatch: false,
    remasterNoticeSeen: false,
    autoSortLoadOrder: false,
  },
};
