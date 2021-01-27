import { IReducerSpec } from '../../../types/IExtensionContext';
import { getSafe, setSafe } from '../../../util/storeHelper';

import { ILoadOrderEntry } from '../types/types';

import * as actions from '../actions/loadOrder';

export const modLoadOrderReducer: IReducerSpec = {
  reducers: {
    [actions.setLoadOrderEntry as any]: (state, payload) => {
      const { profileId, loEntry } = payload;
      const loadOrder = getSafe(state, [profileId], []);
      const newLO = loadOrder.reduce((accum, iter) => {
        if (iter.id === loEntry.id) {
          accum.push(loEntry);
        } else {
          accum.push(iter);
        }
        return accum;
      }, []);
      return setSafe(state, [profileId], newLO);
    },
    [actions.setNewLoadOrder as any]: (state, payload) => {
      const { profileId, loadOrder } = payload;
      if (Array.isArray(loadOrder)) {
        return setSafe(state, [profileId], loadOrder);
      } else if (typeof loadOrder === 'object') {
        const newLO = Object.keys(loadOrder)
          .reduce((accum, iter) => {
            const gameEntry = loadOrder[iter] as ILoadOrderEntry;
            if (gameEntry !== undefined) {
              accum.push(gameEntry);
            }
            return accum;
          }, []);
        return setSafe(state, [profileId], newLO);
      } else {
        return state;
      }
    },
  },
  defaults: {},
};
