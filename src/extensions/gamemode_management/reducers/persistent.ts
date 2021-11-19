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
      const { gameId, provider, priority, expires, values } = payload;
      let temp = state;
      values.forEach((val: {key: string, title: string, value: any, type: string}) => {
        temp = setSafe(temp, ['gameInfo', gameId, val.key], {
          provider,
          expires,
          priority,
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
