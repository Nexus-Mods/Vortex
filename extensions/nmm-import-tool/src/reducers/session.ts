import { types, util } from "@nexusmods/vortex-api";

import * as actions from "../actions/session";
import type { IModImportSessionState } from "../types/state";

/**
 * reducer for changes to ephemeral session state
 */
const sessionActions = {
  setImportStep: actions.setImportStep,
  selectImportFolder: actions.selectImportFolder,
};

export const sessionReducer: types.IReducerSpec<IModImportSessionState> = util.actionsToReducerSpec<
  IModImportSessionState,
  typeof sessionActions
>(
  {
    importStep: undefined,
    importedMods: {},
    selectFolder: false,
    selectedProfile: undefined,
  },
  sessionActions,
  {
    setImportStep: (state, payload) => util.setSafe(state, ["importStep"], payload),
    selectImportFolder: (state, payload) => {
      const importFolder = payload;
      return util.setSafe(state, ["selectFolder"], importFolder);
    },
  },
);
