import { setPath } from '../actions/settings';

import { createReducer } from 'redux-act';
import update = require('react-addons-update');

import * as path from 'path';

/**
 * reducer for changes to settings regarding mods
 */
export const settingsReducer = createReducer({
  [setPath]: (state, payload) => {
    const { key, path } = payload;
    update(state, { paths: { [key]: { $set: path } } });
  },
}, {
  paths: {
    base: path.join('{USERDATA}', '{GAME}'),
    download: path.join('{base}', 'downloads'),
    install: path.join('{base}', 'mods'),
  },
});
