import { IReducerSpec } from '../../../types/IExtensionContext';

import * as actions from '../actions/interface';
import update = require('react-addons-update');

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setLanguage as any]: (state, payload) =>
      update(state, { language: { $set: payload } }),
    [actions.setProfilesVisible as any]: (state, payload) =>
      update(state, { profilesVisible: { $set: payload.visible } }),
  },
  defaults: {
    language: 'en-GB',
    profilesVisible: false,
  },
};

export default settingsReducer;
