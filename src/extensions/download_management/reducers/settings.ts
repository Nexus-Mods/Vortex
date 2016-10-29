import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/settings';

/**
 * reducer for changes to ephemeral session state
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setMaxDownloads]: (state, payload) => {
      return setSafe(state, [ 'maxParallelDownloads' ], payload);
    },
  },
  defaults: {
    minChunkSize: 1024 * 1024,
    maxChunks: 4,
    maxParallelDownloads: 2,
  },
};
