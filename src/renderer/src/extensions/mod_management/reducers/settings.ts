import { actionsToPartialReducerSpec } from "../../../reducers/builder";
import type { ISettingsMods } from "../../../types/IState";
import * as actions from "../actions/settings";

/**
 * reducer for changes to settings regarding mods. Partial: installer_fomod_ipc owns
 * installerSandbox in the same slice.
 */
export const settingsReducer = actionsToPartialReducerSpec<ISettingsMods, typeof actions>(
  {
    installPath: {},
    installPathMode: "userData",
    suggestInstallPathDirectory: "Vortex Mods",
    modlistState: {},
    activator: {},
    showDropzone: true,
    confirmPurge: true,
    cleanupOnDeploy: false,
    betaTable: false,
  },
  actions,
  {
    setInstallPath: (state, payload) => ({
      ...state,
      installPath: { ...state.installPath, [payload.gameId]: payload.path },
    }),
    setInstallPathMode: (state, payload) => ({ ...state, installPathMode: payload }),
    setSuggestInstallPathDirectory: (state, payload) => ({
      ...state,
      suggestInstallPathDirectory: payload,
    }),
    setActivator: (state, payload) => ({
      ...state,
      activator: { ...state.activator, [payload.gameId]: payload.activatorId },
    }),
    setShowModDropzone: (state, payload) => ({ ...state, showDropzone: payload }),
    setConfirmPurge: (state, payload) => ({ ...state, confirmPurge: payload }),
    setCleanupOnDeploy: (state, payload) => ({ ...state, cleanupOnDeploy: payload }),
    setBetaModsTable: (state, payload) => ({ ...state, betaTable: payload }),
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
