import shortid from "shortid";

import * as actions from "../actions/app";
import type { IApp } from "../types/IState";
import { actionsToReducerSpec } from "./builder";

const defaultState: IApp = {
  instanceId: undefined,
  version: "",
  appVersion: "",
  extensions: {},
  warnedAdmin: 0,
  migrations: [],
  installType: "regular",
};

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
    setExtensionEnabled: (state, payload) => ({
      ...state,
      extensions: {
        ...state.extensions,
        [payload.extensionId]: {
          ...state.extensions[payload.extensionId],
          enabled: payload.enabled,
        },
      },
    }),
    setExtensionVersion: (state, payload) => ({
      ...state,
      extensions: {
        ...state.extensions,
        [payload.extensionId]: {
          ...state.extensions[payload.extensionId],
          version: payload.version,
        },
      },
    }),
    setExtensionEndorsed: (state, payload) => ({
      ...state,
      extensions: {
        ...state.extensions,
        [payload.extensionId]: {
          ...state.extensions[payload.extensionId],
          endorsed: payload.endorsed,
        },
      },
    }),
    removeExtension: (state, payload) => ({
      ...state,
      extensions: {
        ...state.extensions,
        [payload]: { ...state.extensions[payload], remove: true },
      },
    }),
    forgetExtension: (state, payload) => {
      const { [payload]: _, ...extensions } = state.extensions;
      return { ...state, extensions };
    },
    setInstanceId: (state, payload) => ({ ...state, instanceId: payload }),
    setWarnedAdmin: (state, payload) => ({ ...state, warnedAdmin: payload }),
    setInstallType: (state, payload) => ({ ...state, installType: payload }),
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
