import { IReducerSpec } from '../../../types/IExtensionContext';

import { setPath } from '../actions/settings';

import update = require('react-addons-update');

import * as path from 'path';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer: IReducerSpec = {
  reducers: {
    [setPath]: (state, payload) => {
      const { key, path } = payload;
      update(state, { paths: { [key]: { $set: path } } });
    },
  }, defaults: {
    paths: {
      base: path.join('{USERDATA}', '{GAME}'),
      download: path.join('{base}', 'downloads'),
      install: path.join('{base}', 'mods'),
    },
  }
};
