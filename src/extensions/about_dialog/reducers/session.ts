
import { IReducerSpec } from '../../../types/IExtensionContext';

import { setLicenseText } from '../actions/session';

import update = require('react-addons-update');

/**
 * reducer for changes to ephemeral session state
 */
export const sessionReducer: IReducerSpec = {
  reducers: {
    [setLicenseText]: (state, payload) => {
      return update(state, { licenseText: { $set: payload } });
    },
  },
  defaults: {
    licenseText: '',
  },
};
