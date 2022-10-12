import { IReducerSpec } from '../../../types/IExtensionContext';

import * as actions from '../actions/interface';

import update from 'immutability-helper';

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
    [actions.setDesktopNotifications as any]: (state, payload) =>
      update(state, { desktopNotifications: { $set: payload } }),
    [actions.setHideTopLevelCategory as any]: (state, payload) =>
      update(state, { hideTopLevelCategory: { $set: payload.hide } }),
    [actions.showUsageInstruction as any]: (state, payload) =>
      update(state, { usage: { [payload.usageId]: { $set: payload.show } } }),
    [actions.setRelativeTimes as any]: (state, payload) =>
      update(state, { relativeTimes: { $set: payload } }),
    [actions.setForegroundDL as any]: (state, payload) =>
      update(state, { foregroundDL: { $set: payload } }),
  },
  defaults: {
    language: 'en',
    advanced: false,
    profilesVisible: false,
    desktopNotifications: true,
    hideTopLevelCategory: false,
    relativeTimes: true,
    foregroundDL: true,
    usage: {},
  },
};

export default settingsReducer;
