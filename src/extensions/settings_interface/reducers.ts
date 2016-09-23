import { IReducerSpec } from '../../types/IExtensionContext';

import { setLanguage } from './actions';
import update = require('react-addons-update');

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [setLanguage]: (state, payload) => update(state, { language: { $set: payload } }),
  },
  defaults: {
    language: 'en-GB',
  },
};

export default settingsReducer;
