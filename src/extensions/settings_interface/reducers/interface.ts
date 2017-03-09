import { IReducerSpec } from '../../../types/IExtensionContext';

import { setLanguage } from '../actions/interface';
import update = require('react-addons-update');

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [setLanguage as any]: (state, payload) => update(state, { language: { $set: payload } }),
  },
  defaults: {
    language: 'en-GB',
  },
};

export default settingsReducer;
