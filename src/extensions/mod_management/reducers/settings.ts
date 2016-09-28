import { IReducerSpec } from '../../../types/IExtensionContext';
import { log } from '../../../util/log';

import { setModlistAttributeSort, setModlistAttributeVisible, setPath } from '../actions/settings';
import { IStateSettings } from '../types/IStateSettings';

import update = require('react-addons-update');

import * as path from 'path';

function ensureAttribute(state: IStateSettings, attributeId: string): IStateSettings {
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

      log('info', 'reducer', { attributeId, direction });

      return update(ensureAttribute(state, attributeId), {
        modlistState: {
          [attributeId]: {
            sortDirection: { $set: direction },
          },
        },
      });
    },
  }, defaults: {
    paths: {
      base: path.join('{USERDATA}', '{GAME}'),
      download: path.join('{base}', 'downloads'),
      install: path.join('{base}', 'mods'),
    },
    modlistState: { },
  },
};
