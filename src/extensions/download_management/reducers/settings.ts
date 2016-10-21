import { IReducerSpec } from '../../../types/IExtensionContext';

/**
 * reducer for changes to ephemeral session state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
  },
  defaults: {
    minChunkSize: 1024 * 1024,
    maxChunks: 4,
    maxParallelDownloads: 2,
  },
};
