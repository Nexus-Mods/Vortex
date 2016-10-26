import { IReducerSpec } from '../../../types/IExtensionContext';
import { setSafe } from '../../../util/storeHelper';

import { setActivator, setModlistAttributeSort,
         setModlistAttributeVisible, setPath } from '../actions/settings';

import update = require('react-addons-update');

import * as path from 'path';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    ['persist/REHYDRATE']: (state, payload) => {
      if (payload.hasOwnProperty('gameSettings') &&
          payload.gameSettings.hasOwnProperty('mods')) {
        return update(state, { $set: payload.gameSettings.mods });
      } else {
        return state;
      }
    },
    [setPath]: (state, payload) => {
      return setSafe(state, [ 'paths', payload.key ], payload.path);
    },
    [setModlistAttributeVisible]: (state, payload) => {
      return setSafe(state, [ 'modlistState', payload.attributeId, 'enabled' ], payload.visible);
    },
    [setModlistAttributeSort]: (state, payload) => {
      const { attributeId, direction } = payload;
      return setSafe(state, [ 'modlistState', attributeId, 'sortDirection' ], direction);
    },
    [setActivator]: (state, payload) => {
      return setSafe(state, [ 'activator' ], payload);
    },
  }, defaults: {
    paths: {
      base: path.join('{USERDATA}', '{GAME}'),
      download: path.join('{base}', 'downloads'),
      install: path.join('{base}', 'mods'),
    },
    modlistState: { },
    activator: undefined,
  },
};
