import { types, util } from "@nexusmods/vortex-api";

import * as actions from "./actions";

export interface ISettingsWrittenEntry {
  time: number;
  count: number;
}

/** `settings.baldursgate3` */
export interface IBG3Settings {
  migration: boolean;
  autoExportLoadOrder: boolean;
  /** the in-game player profile; "global" when none is chosen */
  playerProfile: string;
  /** when the game settings were last written, per player profile */
  settingsWritten: { [profile: string]: ISettingsWrittenEntry };
  extensionVersion: string;
}

declare module "@nexusmods/vortex-api" {
  namespace types {
    interface ISettings {
      baldursgate3: IBG3Settings;
    }
  }
}

// reducer
const reducer: types.IReducerSpec<IBG3Settings> = {
  reducers: {
    [actions.setMigration as any]: (state: IBG3Settings, payload: boolean) =>
      util.setSafe(state, ["migration"], payload),
    [actions.setAutoExportLoadOrder as any]: (state: IBG3Settings, payload: boolean) =>
      util.setSafe(state, ["autoExportLoadOrder"], payload),
    [actions.setPlayerProfile as any]: (state: IBG3Settings, payload: string) =>
      util.setSafe(state, ["playerProfile"], payload),
    [actions.setBG3ExtensionVersion as any]: (state: IBG3Settings, payload: { version: string }) =>
      util.setSafe(state, ["extensionVersion"], payload.version),
    [actions.settingsWritten as any]: (
      state: IBG3Settings,
      payload: { profile: string; time: number; count: number },
    ) => {
      const { profile, time, count } = payload;
      return util.setSafe(state, ["settingsWritten", profile], { time, count });
    },
  },
  defaults: {
    migration: true,
    autoExportLoadOrder: true,
    playerProfile: "global",
    settingsWritten: {},
    extensionVersion: "0.0.0",
  },
};

export default reducer;
