import { IReducerSpec } from '../../../types/IExtensionContext';

import * as actions from '../actions/interface';

import * as update from 'immutability-helper';

/**
 * reducer for changes to interface settings
 */
const settingsReducer: IReducerSpec = {
  reducers: {
    [actions.setLanguage as any]: (state, payload) =>
      update(state, { language: { $set: payload } }),
    [actions.setAdvancedMode as any]: (state, payload) =>
      update(state, { advanced: { $set: payload.advanced } }),
    [actions.setProfilesVisible as any]: (state, payload) =>
      update(state, { profilesVisible: { $set: payload.visible } }),
  },
  defaults: {
    language: 'en',
    advanced: false,
    profilesVisible: false,
  },
};

export default settingsReducer;
