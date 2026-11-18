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
const settingsActions = {
  setSuppressModLimitPatch,
  setRemasterNoticeSeen,
  autoSortLoadOrderChanged,
};

export const W3Reducer = util.actionsToReducerSpec<IW3Settings, typeof settingsActions>(
  {
    suppressModLimitPatch: false,
    remasterNoticeSeen: false,
    autoSortLoadOrder: false,
  },
  settingsActions,
  {
    setSuppressModLimitPatch: (state, payload) =>
      util.setSafe(state, ["suppressModLimitPatch"], payload),
    setRemasterNoticeSeen: (state, payload) => util.setSafe(state, ["remasterNoticeSeen"], payload),
    autoSortLoadOrderChanged: (state, payload) => ({ ...state, autoSortLoadOrder: payload }),
  },
);
