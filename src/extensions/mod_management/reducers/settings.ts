import { IReducerSpec } from '../../../types/IExtensionContext';

import { setActivator, setModlistAttributeSort,
         setModlistAttributeVisible, setPath } from '../actions/settings';
import { IStateModSettings } from '../types/IStateSettings';

import update = require('react-addons-update');

import * as path from 'path';

function ensureAttribute(state: IStateModSettings, attributeId: string): IStateModSettings {
  if (!(attributeId in state.modlistState)) {
    return update(state, { modlistState: { [ attributeId ]: { $set: {} } } });
  } else {
    return state;
  }
}

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
      const { key, path } = payload;
      return update(state, { paths: { [key]: { $set: path } } });
    },
    [setModlistAttributeVisible]: (state, payload) => {
      const { attributeId, visible } = payload;

      return update(ensureAttribute(state, attributeId),
                    { modlistState: { [attributeId]: { enabled: { $set: visible } } } });
    },
    [setModlistAttributeSort]: (state, payload) => {
      const { attributeId, direction } = payload;

      return update(ensureAttribute(state, attributeId), {
        modlistState: {
          [attributeId]: {
            sortDirection: { $set: direction },
          },
        },
      });
    },
    [setActivator]: (state, payload) => {
      return update(state, {
        activator: { $set: payload },
      });
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
