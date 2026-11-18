import type { ISettingsMods } from "@/types/IState";

import { actionsToReducerSpec } from "../../../reducers/builder";
import * as actions from "../actions/settings";

declare module "@/types/IState" {
  interface ISettingsMods {
    /** Whether the Properties panel shows beside the new Mods table. */
    propertiesOpen: boolean;
  }
}

/**
 * What this reducer keeps under `settings.mods`: all of it but the FOMOD installer's sandbox
 * switch, which that installer's own reducer keeps there.
 */
type ModsSettingsState = Omit<ISettingsMods, "installerSandbox">;

const defaultState: ModsSettingsState = {
  installPath: {},
  installPathMode: "userData",
  suggestInstallPathDirectory: "Vortex Mods",
  modlistState: {},
  activator: {},
  showDropzone: true,
  confirmPurge: true,
  cleanupOnDeploy: false,
  betaTable: false,
  propertiesOpen: false,
};

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer = actionsToReducerSpec<ModsSettingsState, typeof actions>(
  defaultState,
  actions,
  {
    setInstallPath: (state, { gameId, path }) => ({
      ...state,
      installPath: { ...state.installPath, [gameId]: path },
    }),
    setInstallPathMode: (state, mode) => ({ ...state, installPathMode: mode }),
    setSuggestInstallPathDirectory: (state, path) => ({
      ...state,
      suggestInstallPathDirectory: path,
    }),
    setActivator: (state, { gameId, activatorId }) => ({
      ...state,
      activator: { ...state.activator, [gameId]: activatorId },
    }),
    setShowModDropzone: (state, show) => ({ ...state, showDropzone: show }),
    setConfirmPurge: (state, confirm) => ({ ...state, confirmPurge: confirm }),
    setCleanupOnDeploy: (state, cleanup) => ({ ...state, cleanupOnDeploy: cleanup }),
    setBetaModsTable: (state, beta) => ({ ...state, betaTable: beta }),
    setModsTablePropertiesOpen: (state, open) => ({ ...state, propertiesOpen: open }),
  },
  {
    installPath: {
      // shouldn't be possible
      description: () => "Severe! Invalid set of staging folders",
      elements: {
        _: {
          description: () => "Severe! A mod staging folder was corrupted and has to be reset",
          type: "string",
        },
      },
    },
  },
);
