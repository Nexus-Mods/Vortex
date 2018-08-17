import { IReducerSpec } from '../../../types/IExtensionContext';

import { setAutoDeployment } from '../actions/automation';

import update from 'immutability-helper';

/**
 * reducer for changes to automation settings
 */
const automationReducer: IReducerSpec = {
  reducers: {
    [setAutoDeployment as any]: (state, payload) => update(state, { deploy: { $set: payload } }),
  },
  defaults: {
    deploy: true,
  },
};

export default automationReducer;
