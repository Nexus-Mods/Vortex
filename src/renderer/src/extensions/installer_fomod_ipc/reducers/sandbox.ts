import { actionsToPartialReducerSpec } from "../../../reducers/builder";
import type { ISettingsMods } from "../../../types/IState";
import * as actions from "../actions/sandbox";

/** Partial: mod_management owns the rest of settings.mods. */
export const settingsReducer = actionsToPartialReducerSpec<ISettingsMods, typeof actions>(
  {
    installerSandbox: true,
  },
  actions,
  {
    setInstallerSandbox: (state, payload) => ({ ...state, installerSandbox: payload }),
  },
);
