import * as path from "path";

import { actionsToReducerSpec } from "../../../reducers/builder";
import type { ISettingsDownloads } from "../../../types/IState";
import * as actions from "../actions/settings";

/**
 * reducer for changes to download settings
 */
export const settingsReducer = actionsToReducerSpec<ISettingsDownloads, typeof actions>(
  {
    minChunkSize: 1024 * 1024,
    maxChunks: 10,
    maxParallelDownloads: 1,
    maxBandwidth: 0,
    path: path.join("{USERDATA}", "downloads"),
    showDropzone: true,
    showGraph: true,
    copyOnIFF: false,
    collectionsInstallWhileDownloading: true,
  },
  actions,
  {
    setMaxDownloads: (state, payload) => ({ ...state, maxParallelDownloads: payload }),
    setDownloadPath: (state, payload) => ({ ...state, path: payload }),
    setShowDLDropzone: (state, payload) => ({ ...state, showDropzone: payload }),
    setShowDLGraph: (state, payload) => ({ ...state, showGraph: payload }),
    setCopyOnIFF: (state, payload) => ({ ...state, copyOnIFF: payload }),
    setMaxBandwidth: (state, payload) => ({ ...state, maxBandwidth: payload }),
    setCollectionConcurrency: (state, payload) => ({
      ...state,
      collectionsInstallWhileDownloading: payload,
    }),
  },
  {
    path: {
      description: () => "Severe! The download folder is invalid and will be reset",
      type: "string",
    },
  },
);
