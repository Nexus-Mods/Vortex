import { IReducerSpec } from '../../../types/IExtensionContext';
import { ISettingsAutomation } from '../../../types/IState';

import * as actions from '../actions/automation';

import update from 'immutability-helper';

/**
 * reducer for changes to automation settings
 */
const automationReducer: IReducerSpec<ISettingsAutomation> = {
  reducers: {
    [actions.setAutoDeployment as any]: (state, payload) =>
      update(state, { deploy: { $set: payload } }),
    [actions.setAutoInstall as any]: (state, payload) =>
      update(state, { install: { $set: payload } }),
    [actions.setAutoEnable as any]: (state, payload) =>
      update(state, { enable: { $set: payload } }),
    [actions.setAutoStart as any]: (state, payload) =>
      update(state, { start: { $set: payload } }),
    [actions.setStartMinimized as any]: (state, payload) =>
      update(state, { minimized: { $set: payload } }),
  },
  defaults: {
    deploy: true,
    install: false,
    enable: false,
    start: false,
    minimized: false,
  },
};

export default automationReducer;
