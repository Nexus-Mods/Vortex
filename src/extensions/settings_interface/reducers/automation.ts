import { IReducerSpec } from '../../../types/IExtensionContext';

import { setAutoDeployment } from '../actions/automation';
import update = require('react-addons-update');

/**
 * reducer for changes to automation settings
 */
const automationReducer: IReducerSpec = {
  reducers: {
    [setAutoDeployment]: (state, payload) => update(state, { deploy: { $set: payload } }),
  },
  defaults: {
    deploy: true,
  },
};

export default automationReducer;
