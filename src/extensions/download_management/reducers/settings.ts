import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/settings';

/**
 * reducer for changes to ephemeral session state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setMaxDownloads as any]: (state, payload) =>
      setSafe(state, ['maxParallelDownloads'], payload),
    [actions.setShowDLDropzone as any]: (state, payload) =>
      setSafe(state, ['showDropzone'], payload),
    [actions.setShowDLGraph as any]: (state, payload) =>
      setSafe(state, ['showGraph'], payload),
  },
  defaults: {
    minChunkSize: 1024 * 1024,
    maxChunks: 4,
    maxParallelDownloads: 1,
    showDropzone: true,
    showGraph: true,
  },
};
