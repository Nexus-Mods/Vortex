import { types, util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { IModImportSessionState, ImportStep } from "../types/state";

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: types.IReducerSpec<IModImportSessionState> = {
  reducers: {
    [actions.setImportStep as any]: (state: IModImportSessionState, payload: ImportStep) =>
      util.setSafe(state, ["importStep"], payload),
    [actions.selectImportFolder as any]: (state: IModImportSessionState, payload: boolean) => {
      const importFolder = payload;
      return util.setSafe(state, ["selectFolder"], importFolder);
    },
  },
  defaults: {
    importStep: undefined,
    importedMods: {},
    selectFolder: false,
    selectedProfile: undefined,
  },
};
