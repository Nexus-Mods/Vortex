import { types, util } from "@nexusmods/vortex-api";

import { setPriorityType, setRemasterNoticeSeen, setSuppressModLimitPatch } from "./actions";

// reducer
export const W3Reducer: types.IReducerSpec = {
  reducers: {
    [setPriorityType as any]: (state, payload) => {
      return util.setSafe(state, ["prioritytype"], payload);
    },
    [setSuppressModLimitPatch as any]: (state, payload) => {
      return util.setSafe(state, ["suppressModLimitPatch"], payload);
    },
    [setRemasterNoticeSeen as any]: (state, payload) => {
      return util.setSafe(state, ["remasterNoticeSeen"], payload);
    },
  },
  defaults: {
    prioritytype: "prefix-based",
    suppressModLimitPatch: false,
    remasterNoticeSeen: false,
  },
};
