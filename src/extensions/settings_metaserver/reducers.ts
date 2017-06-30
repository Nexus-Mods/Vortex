import { IReducerSpec } from '../../types/IExtensionContext';
import {deleteOrNop, setSafe} from '../../util/storeHelper';

import * as actions from './actions';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.addMetaserver as any]:
    (state, payload) => setSafe(state, ['servers', payload.id], {
        url: payload.url,
        cacheDurationSec: payload.cacheDurationSec || 86400,
        priority: Object.keys(state.servers).length,
      }),
    [actions.removeMetaserver as any]:
        (state, payload) => deleteOrNop(state, ['servers', payload.id]),
    [actions.setPriorities as any]:
        (state, payload) => {
          const copy = { ...state };
          payload.ids.forEach((id, idx) => {
            copy.servers[id].priority = idx;
          });
          return copy;
        },
  },
  defaults: {
    servers: {},
  },
};

export default settingsReducer;
