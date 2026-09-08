import shortid from "shortid";

import * as actions from "../actions/app";
import type { IApp, IExtensionState } from "../types/IState";
import { actionsToReducerSpec } from "./builder";

const defaultState: IApp = {
  instanceId: undefined,
  version: "",
  appVersion: "",
  extensions: {},
  warnedAdmin: 0,
  migrations: [],
  installType: "regular",
  // main overwrites this at startup; false until then so nothing checks before we know
  updaterActive: false,
};

// entries are created only by addExtension, so a write through a key naming
// none must not mint a partial entry holding just that field
function updateExtension(
  state: IApp,
  extensionId: string,
  changes: Partial<IExtensionState>,
): IApp {
  if (state.extensions[extensionId] === undefined) return state;
  return {
    ...state,
    extensions: {
      ...state.extensions,
      [extensionId]: { ...state.extensions[extensionId], ...changes },
    },
  };
}

export const appReducer = actionsToReducerSpec(
  defaultState,
  actions,
  {
    setStateVersion: (state, payload) => ({ ...state, version: payload }),
    setApplicationVersion: (state, payload) => ({ ...state, appVersion: payload }),
    addExtension: (state, payload) => {
      const { extension } = payload;
      const id = shortid();

      return {
        ...state,
        extensions: {
          ...state.extensions,
          [id]: extension,
        },
      };
    },
    setExtensionEnabled: (state, payload) =>
      updateExtension(state, payload.extensionId, { enabled: payload.enabled }),
    setExtensionVersion: (state, payload) =>
      updateExtension(state, payload.extensionId, { version: payload.version }),
    setExtensionEndorsed: (state, payload) =>
      updateExtension(state, payload.extensionId, { endorsed: payload.endorsed }),
    removeExtension: (state, payload) => updateExtension(state, payload, { remove: true }),
    forgetExtension: (state, payload) => {
      const { [payload]: _, ...extensions } = state.extensions;
      return { ...state, extensions };
    },
    setInstanceId: (state, payload) => ({ ...state, instanceId: payload }),
    setWarnedAdmin: (state, payload) => ({ ...state, warnedAdmin: payload }),
    setInstallType: (state, payload) => ({ ...state, installType: payload }),
    setUpdaterActive: (state, payload) => ({ ...state, updaterActive: payload }),
    completeMigration: (state, payload) => ({
      ...state,
      migrations: [...state.migrations, payload],
    }),
  },
  {
    instanceId: {
      description: () => "No instance id set",
      type: "string",
    },
    version: {
      description: () => "Version not set",
      type: "string",
    },
    appVersion: {
      description: () => "Application version not set",
      type: "string",
    },
    extensions: {
      description: () => "Resetting list of disabled extensions",
      noUndefined: true,
    },
  },
);
