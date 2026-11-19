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
const reducer = util.actionsToReducerSpec<IBG3Settings, typeof actions>(
  {
    migration: true,
    autoExportLoadOrder: true,
    playerProfile: "global",
    settingsWritten: {},
    extensionVersion: "0.0.0",
  },
  actions,
  {
    setMigration: (state, payload) => util.setSafe(state, ["migration"], payload),
    setAutoExportLoadOrder: (state, payload) =>
      util.setSafe(state, ["autoExportLoadOrder"], payload),
    setPlayerProfile: (state, payload) => util.setSafe(state, ["playerProfile"], payload),
    setBG3ExtensionVersion: (state, payload) =>
      util.setSafe(state, ["extensionVersion"], payload.version),
    settingsWritten: (state, payload) => {
      const { profile, time, count } = payload;
      return util.setSafe(state, ["settingsWritten", profile], { time, count });
    },
  },
);

export default reducer;
