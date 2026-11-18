import { types, util } from "@nexusmods/vortex-api";

import {
  autoSortLoadOrderChanged,
  setRemasterNoticeSeen,
  setSuppressModLimitPatch,
} from "./actions";

/** `settings.witcher3` */
export interface IW3Settings {
  suppressModLimitPatch: boolean;
  remasterNoticeSeen: boolean;
  autoSortLoadOrder: boolean;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISettings {
      witcher3: IW3Settings;
    }
  }
}

// reducer
export const W3Reducer: types.IReducerSpec<IW3Settings> = {
  reducers: {
    [setSuppressModLimitPatch as any]: (state: IW3Settings, payload: boolean) => {
      return util.setSafe(state, ["suppressModLimitPatch"], payload);
    },
    [setRemasterNoticeSeen as any]: (state: IW3Settings, payload: boolean) => {
      return util.setSafe(state, ["remasterNoticeSeen"], payload);
    },
    [autoSortLoadOrderChanged as any]: (state: IW3Settings, payload: boolean): IW3Settings => ({
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
