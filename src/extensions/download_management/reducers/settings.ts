import { IReducerSpec } from '../../../types/IExtensionContext';
import { ISettingsDownloads } from '../../../types/IState';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/settings';

import * as path from 'path';

/**
 * reducer for changes to ephemeral session state
 */
export const settingsReducer: IReducerSpec<ISettingsDownloads> = {
  reducers: {
    [actions.setMaxDownloads as any]: (state, payload) =>
      setSafe(state, ['maxParallelDownloads'], payload),
    [actions.setDownloadPath as any]: (state, payload) =>
      setSafe(state, ['path'], payload),
    [actions.setShowDLDropzone as any]: (state, payload) =>
      setSafe(state, ['showDropzone'], payload),
    [actions.setShowDLGraph as any]: (state, payload) =>
      setSafe(state, ['showGraph'], payload),
    [actions.setCopyOnIFF as any]: (state, payload) =>
      setSafe(state, ['copyOnIFF'], payload),
  },
  defaults: {
    minChunkSize: 1024 * 1024,
    maxChunks: 4,
    maxParallelDownloads: 1,
    path: path.join('{USERDATA}', 'downloads'),
    showDropzone: true,
    showGraph: true,
    copyOnIFF: false,
  },
};
