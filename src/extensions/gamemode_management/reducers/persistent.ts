import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import * as actions from '../actions/persistent';

import * as _ from 'lodash';

/**
 * reducer for changes to ephemeral session state
 */
export const persistentReducer: IReducerSpec = {
  reducers: {
    [actions.setGameInfo as any]: (state, payload) => {
      let temp = state;
      payload.values.forEach((val: {key: string, title: string, value: any, type: string}) => {
        temp = setSafe(temp, ['gameInfo', payload.gameId, val.key], {
          provider: payload.provider,
          expires: payload.expires,
          title: val.title,
          value: val.value,
          type: val.type,
        });
      });
      return temp;
    },
  },
  defaults: {
    gameInfo: {},
  },
};
